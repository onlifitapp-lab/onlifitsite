// Shared Razorpay subscription purchase/renew/upgrade flow.
// Used by pricing.html and bookings.html (trainer dashboard).

let _razorpayCheckoutPromise = null;
function loadRazorpayCheckout() {
    if (window.Razorpay) return Promise.resolve();
    if (_razorpayCheckoutPromise) return _razorpayCheckoutPromise;
    _razorpayCheckoutPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load payment SDK.'));
        document.head.appendChild(script);
    });
    return _razorpayCheckoutPromise;
}

// onStatus(status, message) — status: 'loading' | 'error' | 'done'
async function purchaseSubscription(plan, onStatus) {
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

        await loadRazorpayCheckout();

        const orderRes = await fetch('/api/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
            body: JSON.stringify({ type: 'subscription', plan })
        });
        const orderData = await orderRes.json();

        if (!orderRes.ok) {
            if (orderData.code === 'EMAIL_NOT_VERIFIED') {
                notify('error', 'Please verify your email before purchasing a subscription. Check your inbox for the verification link.');
            } else {
                notify('error', orderData.error || 'Could not start checkout.');
            }
            return;
        }

        const rzp = new Razorpay({
            key: orderData.keyId,
            amount: orderData.amount,
            currency: orderData.currency,
            name: 'Onlifit',
            description: `${plan === 'elite' ? 'Elite' : 'Pro'} Plan Subscription`,
            order_id: orderData.orderId,
            theme: { color: '#000000' },
            handler: async function (rpResponse) {
                notify('loading', 'Confirming payment...');
                try {
                    const verifyRes = await fetch('/api/verify-payment', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
                        body: JSON.stringify({
                            type: 'subscription',
                            razorpay_order_id: rpResponse.razorpay_order_id,
                            razorpay_payment_id: rpResponse.razorpay_payment_id,
                            razorpay_signature: rpResponse.razorpay_signature
                        })
                    });
                    const verifyData = await verifyRes.json();
                    if (verifyRes.ok && verifyData.success) {
                        notify('done', 'Subscription activated successfully.');
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

window.purchaseSubscription = purchaseSubscription;
