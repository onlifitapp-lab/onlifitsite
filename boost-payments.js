// Shared Razorpay Boost purchase flow. Used by pricing.html and
// bookings.html (trainer dashboard). Mirrors subscription-payments.js's
// pattern exactly — same Checkout.js loader, same handler/verify shape —
// so there's one proven purchase flow, not two divergent ones.

function loadRazorpayCheckoutForBoost() {
    if (window.Razorpay) return Promise.resolve();
    if (window._razorpayCheckoutPromise) return window._razorpayCheckoutPromise;
    window._razorpayCheckoutPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load payment SDK.'));
        document.head.appendChild(script);
    });
    return window._razorpayCheckoutPromise;
}

// onStatus(status, message) — status: 'loading' | 'error' | 'done'
async function purchaseBoost(durationDays, onStatus) {
    const notify = (status, message) => { if (typeof onStatus === 'function') onStatus(status, message); };

    try {
        notify('loading', 'Preparing checkout...');

        const user = await getCurrentUser();
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        const authHeader = typeof getApiAuthHeader === 'function' ? await getApiAuthHeader() : null;
        if (!authHeader) {
            notify('error', 'Please log in to continue.');
            return;
        }

        await loadRazorpayCheckoutForBoost();

        const orderRes = await fetch('/api/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
            body: JSON.stringify({ type: 'boost', durationDays })
        });
        const orderData = await orderRes.json();

        if (!orderRes.ok) {
            notify('error', orderData.error || 'Could not start checkout.');
            return;
        }

        const rzp = new Razorpay({
            key: orderData.keyId,
            amount: orderData.amount,
            currency: orderData.currency,
            name: 'Onlifit',
            description: `${durationDays}-Day Boost`,
            order_id: orderData.orderId,
            theme: { color: '#000000' },
            handler: async function (rpResponse) {
                notify('loading', 'Confirming payment...');
                try {
                    const verifyRes = await fetch('/api/verify-payment', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
                        body: JSON.stringify({
                            type: 'boost',
                            razorpay_order_id: rpResponse.razorpay_order_id,
                            razorpay_payment_id: rpResponse.razorpay_payment_id,
                            razorpay_signature: rpResponse.razorpay_signature
                        })
                    });
                    const verifyData = await verifyRes.json();
                    if (verifyRes.ok && verifyData.success) {
                        notify('done', 'Boost activated! Your profile is now getting priority visibility.');
                    } else {
                        notify('error', 'Payment received but activation failed. Contact support if this persists.');
                    }
                } catch (e) {
                    notify('error', 'Could not confirm payment. If money was deducted, contact support.');
                }
            },
            modal: {
                ondismiss: function () { notify('error', ''); }
            }
        });

        rzp.on('payment.failed', function (response) {
            notify('error', 'Payment failed: ' + (response?.error?.description || 'Please try again.'));
        });

        notify('idle', '');
        rzp.open();
    } catch (err) {
        notify('error', err.message || 'Something went wrong.');
    }
}

window.purchaseBoost = purchaseBoost;
