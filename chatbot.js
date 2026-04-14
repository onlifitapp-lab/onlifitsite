document.addEventListener('DOMContentLoaded', () => {
    // 1. Inject Chatbot CSS
    const style = document.createElement('style');
    style.innerHTML = `
        #onlifit-bot-btn {
            position: fixed;
            bottom: 24px;
            right: 24px;
            width: 60px;
            height: 60px;
            background: #000;
            color: #fff;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            cursor: pointer;
            z-index: 9999;
            transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        #onlifit-bot-btn:hover { transform: scale(1.1); }
        
        #onlifit-chat-window {
            position: fixed;
            bottom: 100px;
            right: 24px;
            width: 360px;
            height: 500px;
            background: #fff;
            border-radius: 20px;
            box-shadow: 0 15px 45px rgba(0,0,0,0.15);
            display: flex;
            flex-direction: column;
            z-index: 9998;
            opacity: 0;
            pointer-events: none;
            transform: translateY(20px);
            transition: all 0.3s ease;
            overflow: hidden;
            border: 1px solid rgba(0,0,0,0.08);
        }
        #onlifit-chat-window.active {
            opacity: 1;
            pointer-events: all;
            transform: translateY(0);
        }

        .chat-header {
            background: #000;
            color: white;
            padding: 16px 20px;
            font-family: 'Poppins', sans-serif;
            font-weight: 600;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .chat-header .close-btn {
            cursor: pointer;
            background: none;
            border: none;
            color: white;
        }

        .chat-messages {
            flex: 1;
            padding: 20px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 12px;
            background: #fafafa;
        }

        .msg-bubble {
            max-width: 80%;
            padding: 12px 16px;
            border-radius: 16px;
            font-size: 14px;
            line-height: 1.5;
            font-family: 'Inter', sans-serif;
            animation: fadeIn 0.3s ease forwards;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .msg-bot {
            background: #f0f0f0;
            color: #000;
            align-self: flex-start;
            border-bottom-left-radius: 4px;
        }

        .msg-user {
            background: #000;
            color: white;
            align-self: flex-end;
            border-bottom-right-radius: 4px;
        }

        .chat-input-area {
            padding: 16px;
            background: white;
            border-top: 1px solid #f0f0f0;
            display: flex;
            gap: 8px;
        }

        .chat-input-area input {
            flex: 1;
            padding: 12px 16px;
            border: 1px solid #e0e0e0;
            border-radius: 24px;
            outline: none;
            font-family: 'Inter', sans-serif;
            font-size: 14px;
            transition: border-color 0.2s;
        }
        .chat-input-area input:focus { border-color: #000; }
        
        .chat-input-area button {
            background: #000;
            color: white;
            border: none;
            width: 44px;
            height: 44px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            transition: background 0.2s;
        }
        .chat-input-area button:hover { background: #333; }

        .bot-options {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 5px;
        }
        .bot-option-btn {
            background: white;
            border: 1px solid #000;
            color: #000;
            padding: 8px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }
        .bot-option-btn:hover { background: #000; color: white; }
    `;
    document.head.appendChild(style);

    // 2. Inject HTML 
    const chatHTML = `
        <div id="onlifit-bot-btn">
            <span class="material-symbols-outlined" style="font-size: 28px;">smart_toy</span>
        </div>

        <div id="onlifit-chat-window">
            <div class="chat-header">
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="width:10px; height:10px; background:#4ade80; border-radius:50%; box-shadow: 0 0 8px #4ade80;"></div>
                    <span>Onlifit Support</span>
                </div>
                <button class="close-btn material-symbols-outlined" id="chat-close">close</button>
            </div>
            <div class="chat-messages" id="chat-messages">
                <div class="msg-bubble msg-bot">
                    Hi! I'm the Onlifit Assistant. I can help you with pricing, finding a trainer, or resolving platform issues. How can I help today?
                    <div class="bot-options">
                        <button class="bot-option-btn" onclick="sendOption('How much does it cost?')">Pricing</button>
                        <button class="bot-option-btn" onclick="sendOption('How do I become a trainer?')">Become a Trainer</button>
                        <button class="bot-option-btn" onclick="sendOption('I have a problem')">Report an Issue</button>
                    </div>
                </div>
            </div>
            <div class="chat-input-area">
                <input type="text" id="chat-input" placeholder="Type your message..." autocomplete="off">
                <button id="chat-send"><span class="material-symbols-outlined">send</span></button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', chatHTML);

    // 3. Logic Configuration
    const botBtn = document.getElementById('onlifit-bot-btn');
    const chatWindow = document.getElementById('onlifit-chat-window');
    const closeBtn = document.getElementById('chat-close');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const chatSend = document.getElementById('chat-send');

    botBtn.addEventListener('click', () => {
        chatWindow.classList.toggle('active');
        if(chatWindow.classList.contains('active')) chatInput.focus();
    });
    
    closeBtn.addEventListener('click', () => chatWindow.classList.remove('active'));

    // Brain for the chatbot
    const knowledgeBase = {
        pricing: "Onlifit is completely free for clients to browse and join! For trainers, we have tiers ranging from 0% to 30% commission depending on your subscription. You can view all details on our Pricing page.",
        trainer: "You can become a trainer by clicking 'Join as Trainer' in the navigation menu. Once you fill out your KYC documents, our team will verify your account within 24 hours.",
        issue: "I'm sorry to hear you're having an issue. If it's a technical bug, billing problem, or refund request, I can create formal support ticket for our human team to handle.",
        refund: "Purchases and subscriptions are subject to our refund policy. Since trainers are paid out periodically, please create a ticket, and we'll investigate.",
        hello: "Hello! What can I assist you with today?",
        bye: "Goodbye! Stay fit!"
    };

    function processMessage(text) {
        const lowerText = text.toLowerCase();
        
        if (lowerText.includes('price') || lowerText.includes('cost') || lowerText.includes('commission') || lowerText.includes('fee')) {
            return knowledgeBase.pricing;
        } else if (lowerText.includes('trainer') || lowerText.includes('teach') || lowerText.includes('coach')) {
            return knowledgeBase.trainer;
        } else if (lowerText.includes('refund') || lowerText.includes('money')) {
            return knowledgeBase.refund;
        } else if (lowerText.includes('issue') || lowerText.includes('problem') || lowerText.includes('help') || lowerText.includes('broken')) {
            return knowledgeBase.issue + `<br><br><button class="bot-option-btn" onclick="startSupportTicket()" style="margin-top: 10px; border-color: red; color: red;">+ Create Support Ticket</button>`;
        } else if (lowerText.includes('hi') || lowerText.includes('hello')) {
            return knowledgeBase.hello;
        } else {
            // General Fallback -> Escalate to human
            return `I'm not quite sure I understand. I am an AI still in training! Would you like me to open a Support Ticket so a human team member can reach out to you?
            <br><br>
            <div class="bot-options">
                <button class="bot-option-btn" onclick="startSupportTicket()" style="border-color: #000; background: #000; color: #fff;">Yes, open a ticket</button>
            </div>`;
        }
    }

    window.sendOption = function(text) {
        handleUserMessage(text);
    };

    chatSend.addEventListener('click', () => handleUserMessage(chatInput.value));
    chatInput.addEventListener('keypress', (e) => {
        if(e.key === 'Enter') handleUserMessage(chatInput.value);
    });

    let isCreatingTicket = false;
    let ticketData = { subject: '', category: 'other', message: '', email: '' };
    let ticketStep = 0;
    
    // --- RATE LIMITING LOGIC ---
    const MAX_MESSAGES = 15;
    const RATE_LIMIT_WINDOW = 60000; // 1 minute
    let messageHistory = [];

    function checkRateLimit() {
        const now = Date.now();
        // Clean up old messages outside the window
        messageHistory = messageHistory.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
        
        if (messageHistory.length >= MAX_MESSAGES) {
            return false;
        }
        
        messageHistory.push(now);
        return true;
    }

    function handleUserMessage(message) {
        if (!message.trim()) return;
        
        if (!checkRateLimit()) {
            appendMessage('bot', "⚠️ <strong>Rate Limit Exceeded.</strong> You are sending messages too quickly. Please wait a minute before sending another message.");
            return;
        }
        setTimeout(() => {
            const botReply = processMessage(message);
            appendMessage('bot', botReply);
        }, 500);
    }

    function appendMessage(sender, html) {
        const div = document.createElement('div');
        div.className = `msg-bubble ${sender === 'user' ? 'msg-user' : 'msg-bot'}`;
        div.innerHTML = html;
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // --- TICKET ESCALATION FLOW ---
    window.startSupportTicket = function() {
        isCreatingTicket = true;
        ticketStep = 1;
        appendMessage('bot', 'Got it. Let\'s create a support ticket. First, what is the <strong>subject</strong> or short title of your issue?');
    };

    async function handleTicketFlow(message) {
        if (ticketStep === 1) {
            ticketData.subject = message;
            ticketStep = 2;
            setTimeout(() => appendMessage('bot', 'Thanks. Now, please describe the full details of your issue...'), 400);
        } else if (ticketStep === 2) {
            ticketData.message = message;
            
            // Check if they are logged in via Supabase (from localStorage/token)
            const sessionData = await window.supabaseClient?.auth?.getSession();
            if (!sessionData?.data?.session) {
                ticketStep = 3;
                setTimeout(() => appendMessage('bot', 'Since you are not logged in, please provide your <strong>Email Address</strong> so we can reply to you.'), 400);
            } else {
                submitTicket(sessionData.data.session.access_token);
            }
        } else if (ticketStep === 3) {
            ticketData.email = message;
            submitTicket(null); // Guest submit
        }
    }

    async function submitTicket(token) {
        appendMessage('bot', '<span class="material-symbols-outlined" style="animation: spin 1s linear infinite;">sync</span> Creating your ticket securely...');
        
        try {
            const res = await fetch('/api/create-ticket', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subject: ticketData.subject,
                    message: ticketData.message,
                    guestEmail: ticketData.email,
                    authHeader: token ? `Bearer ${token}` : null
                })
            });

            const data = await res.json();
            
            if (data.success) {
                isCreatingTicket = false;
                ticketData = { subject: '', category: 'other', message: '', email: '' }; // reset
                setTimeout(() => appendMessage('bot', `✅ <strong>Ticket #${data.ticketId.substring(0,6)} Generated!</strong><br><br>Our support admin team has been notified and will review this shortly.`), 600);
            } else {
                throw new Error(data.error);
            }
        } catch (err) {
            isCreatingTicket = false;
            setTimeout(() => appendMessage('bot', `❌ Sorry, something went wrong creating the ticket. Please email us directly at support@onlifit.com.`), 600);
        }
    }
});