import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { 
            razorpay_order_id, 
            razorpay_payment_id, 
            razorpay_signature, 
            booking_id
        } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !booking_id) {
            return res.status(400).json({ error: 'Missing security parameters' });
        }

        // 1. Verify Payment Security Signature (HMAC SHA256)
        // This math is exactly how Razorpay proves the payment wasn't faked
        const secret = process.env.RAZORPAY_KEY_SECRET;
        
        if (!secret) {
            console.error("Missing RAZORPAY_KEY_SECRET");
            return res.status(500).json({ error: 'Gateway configuration missing' });
        }

        const generated_signature = crypto
            .createHmac('sha256', secret)
            .update(razorpay_order_id + '|' + razorpay_payment_id)
            .digest('hex');

        if (generated_signature !== razorpay_signature) {
            return res.status(400).json({ error: "PAYMENT SIGNATURE MANIPULATION DETECTED" });
        }

        // 2. Initialize Secure Backend Supabase Client
        const supabase = createClient(
            process.env.VITE_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // 3. Mark the Database Booking row as VERIFIED and CONFIRMED
        const { data: updatedBooking, error: updateError } = await supabase
            .from('bookings')
            .update({ 
                status: 'confirmed',
                transaction_id: razorpay_payment_id
            })
            .eq('id', booking_id)
            .select()
            .single();

        if (updateError || !updatedBooking) {
            console.error('Final DB Error:', updateError);
            return res.status(500).json({ error: 'Payment verified, but failed to synchronize with database' });
        }

        // 4. Notify Trainer they got paid
        await supabase.from('notifications').insert([{
            user_id: updatedBooking.trainer_id,
            type: 'booking',
            title: 'New Confirmed Booking!',
            message: `A client has booked and paid for a ${updatedBooking.plan_label} session. Check your dashboard.`
        }]);

        // Success!
        return res.status(200).json({
            success: true,
            message: 'Payment perfectly verified and applied!',
            data: updatedBooking
        });

    } catch (error) {
        console.error('Verify Order Error:', error);
        return res.status(500).json({ error: 'Internal server error processing payment' });
    }
}