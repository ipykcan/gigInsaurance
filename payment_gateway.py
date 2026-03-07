# payment_gateway.py - Realistic PhonePe Style Payment Gateway
from flask import Flask, request, jsonify
from datetime import datetime
import random

app = Flask(__name__)

# Store transactions
transactions = []

# ============================================
# 1. PAYMENT PAGE - PhonePe Style
# ============================================
@app.route('/pay')
def payment_page():
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>PhonePe - Payment</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            }
            
            body {
                background: #f2f5f9;
                min-height: 100vh;
                display: flex;
                justify-content: center;
                align-items: center;
                padding: 16px;
            }
            
            .phone-frame {
                max-width: 400px;
                width: 100%;
                background: white;
                border-radius: 32px;
                box-shadow: 0 20px 40px rgba(0,0,0,0.15);
                overflow: hidden;
                position: relative;
            }
            
            .status-bar {
                background: #7a2e9a;
                padding: 12px 20px;
                display: flex;
                justify-content: space-between;
                color: white;
                font-size: 14px;
                font-weight: 500;
            }
            
            .header {
                background: #7a2e9a;
                color: white;
                padding: 20px;
                display: flex;
                align-items: center;
                gap: 16px;
            }
            
            .back-button {
                font-size: 24px;
                cursor: pointer;
            }
            
            .header h2 {
                font-size: 20px;
                font-weight: 500;
                flex: 1;
            }
            
            .header-icon {
                background: rgba(255,255,255,0.2);
                padding: 8px;
                border-radius: 50%;
            }
            
            .merchant-info {
                background: #f8f4ff;
                padding: 24px;
                display: flex;
                align-items: center;
                gap: 16px;
                border-bottom: 1px solid #eee;
            }
            
            .merchant-logo {
                width: 56px;
                height: 56px;
                background: #7a2e9a;
                border-radius: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 24px;
                font-weight: bold;
            }
            
            .merchant-details h3 {
                font-size: 18px;
                color: #333;
                margin-bottom: 4px;
            }
            
            .merchant-details p {
                color: #666;
                font-size: 14px;
            }
            
            .badge {
                background: #e8f5e9;
                color: #2e7d32;
                font-size: 12px;
                padding: 4px 8px;
                border-radius: 16px;
                display: inline-block;
                margin-top: 4px;
            }
            
            .amount-card {
                background: linear-gradient(135deg, #7a2e9a, #9b4dbb);
                margin: 20px;
                padding: 24px;
                border-radius: 20px;
                color: white;
                box-shadow: 0 8px 20px rgba(122, 46, 154, 0.3);
            }
            
            .amount-label {
                font-size: 14px;
                opacity: 0.9;
                margin-bottom: 8px;
            }
            
            .amount-value {
                font-size: 42px;
                font-weight: 700;
                margin-bottom: 4px;
            }
            
            .amount-reason {
                font-size: 14px;
                opacity: 0.9;
            }
            
            .payment-methods {
                padding: 20px;
            }
            
            .section-title {
                font-size: 16px;
                color: #333;
                margin-bottom: 16px;
                font-weight: 600;
            }
            
            .method-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 12px;
                margin-bottom: 24px;
            }
            
            .method-item {
                background: white;
                border: 2px solid #eee;
                border-radius: 16px;
                padding: 16px 8px;
                text-align: center;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .method-item.selected {
                border-color: #7a2e9a;
                background: #f8f4ff;
            }
            
            .method-item .emoji {
                font-size: 24px;
                margin-bottom: 8px;
            }
            
            .method-item .name {
                font-size: 13px;
                color: #555;
                font-weight: 500;
            }
            
            .upi-section {
                background: #f8f9fa;
                border-radius: 16px;
                padding: 20px;
                margin-bottom: 20px;
            }
            
            .upi-id-display {
                background: white;
                border: 2px solid #eee;
                border-radius: 12px;
                padding: 16px;
                margin-bottom: 16px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .upi-id-display span {
                font-size: 16px;
                color: #333;
                font-weight: 500;
            }
            
            .change-link {
                color: #7a2e9a;
                font-size: 14px;
                text-decoration: none;
                font-weight: 600;
            }
            
            .saved-banks {
                display: flex;
                gap: 12px;
                margin-bottom: 16px;
                overflow-x: auto;
                padding: 4px 0;
            }
            
            .bank-chip {
                background: white;
                border: 2px solid #eee;
                border-radius: 30px;
                padding: 10px 20px;
                font-size: 14px;
                white-space: nowrap;
                cursor: pointer;
            }
            
            .bank-chip.selected {
                border-color: #7a2e9a;
                background: #f8f4ff;
            }
            
            .pay-button {
                background: #7a2e9a;
                color: white;
                border: none;
                border-radius: 16px;
                padding: 18px;
                width: 100%;
                font-size: 18px;
                font-weight: 600;
                cursor: pointer;
                margin: 20px 0;
                transition: background 0.2s;
            }
            
            .pay-button:hover {
                background: #9b4dbb;
            }
            
            .pay-button:disabled {
                background: #ccc;
                cursor: not-allowed;
            }
            
            .security-info {
                text-align: center;
                color: #888;
                font-size: 13px;
                margin: 20px 0;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 16px;
            }
            
            .security-info span {
                display: flex;
                align-items: center;
                gap: 4px;
            }
            
            .transaction-status {
                background: white;
                border-radius: 20px;
                padding: 24px;
                text-align: center;
                margin: 20px;
                display: none;
            }
            
            .transaction-status.success {
                display: block;
                border: 2px solid #4caf50;
            }
            
            .transaction-status.failed {
                display: block;
                border: 2px solid #f44336;
            }
            
            .status-icon {
                font-size: 48px;
                margin-bottom: 16px;
            }
            
            .status-title {
                font-size: 20px;
                font-weight: 600;
                margin-bottom: 8px;
            }
            
            .status-message {
                color: #666;
                margin-bottom: 16px;
            }
            
            .transaction-details {
                background: #f8f9fa;
                padding: 16px;
                border-radius: 12px;
                text-align: left;
            }
            
            .detail-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 8px;
                font-size: 14px;
            }
            
            .detail-label {
                color: #666;
            }
            
            .detail-value {
                color: #333;
                font-weight: 500;
            }
            
            .done-button {
                background: #7a2e9a;
                color: white;
                border: none;
                border-radius: 12px;
                padding: 16px;
                width: 100%;
                font-size: 16px;
                font-weight: 600;
                margin-top: 20px;
                cursor: pointer;
            }
        </style>
    </head>
    <body>
        <div class="phone-frame">
            <!-- Status Bar -->
            <div class="status-bar">
                <span>📶 5G</span>
                <span>🔋 98%</span>
            </div>
            
            <!-- Header -->
            <div class="header">
                <div class="back-button" onclick="resetToPayment()">←</div>
                <h2>Payment to Business</h2>
                <div class="header-icon">🔔</div>
            </div>
            
            <!-- Main Content -->
            <div id="mainContent">
                <!-- Merchant Info -->
                <div class="merchant-info">
                    <div class="merchant-logo">GI</div>
                    <div class="merchant-details">
                        <h3 id="workerNameDisplay">Gig Worker Insurance</h3>
                        <p id="workerIdDisplay">ID: DEL-123</p>
                        <span class="badge">✓ Verified</span>
                    </div>
                </div>
                
                <!-- Amount Card -->
                <div class="amount-card">
                    <div class="amount-label">Payment Amount</div>
                    <div class="amount-value" id="amountDisplay">₹450</div>
                    <div class="amount-reason" id="reasonDisplay">Heavy Rain - Lost 4 hours</div>
                </div>
                
                <!-- Payment Methods -->
                <div class="payment-methods">
                    <div class="section-title">Pay using</div>
                    
                    <div class="method-grid">
                        <div class="method-item selected" onclick="selectMethod('upi')">
                            <div class="emoji">📱</div>
                            <div class="name">UPI</div>
                        </div>
                        <div class="method-item" onclick="selectMethod('card')">
                            <div class="emoji">💳</div>
                            <div class="name">Card</div>
                        </div>
                        <div class="method-item" onclick="selectMethod('netbanking')">
                            <div class="emoji">🏦</div>
                            <div class="name">NetBanking</div>
                        </div>
                    </div>
                    
                    <!-- UPI Section (Default) -->
                    <div id="upiSection">
                        <div class="section-title">Select UPI ID</div>
                        
                        <div class="upi-id-display">
                            <span>raj@okhdfcbank</span>
                            <a href="#" class="change-link">Change</a>
                        </div>
                        
                        <div class="saved-banks">
                            <div class="bank-chip selected">raj@okhdfcbank</div>
                            <div class="bank-chip">priya@okicici</div>
                            <div class="bank-chip">amit@okaxis</div>
                            <div class="bank-chip">+ Add</div>
                        </div>
                    </div>
                    
                    <!-- Card Section (Hidden) -->
                    <div id="cardSection" style="display: none;">
                        <div class="upi-id-display" style="flex-direction: column; gap: 16px;">
                            <input type="text" placeholder="Card Number" value="4386 2894 0766 0153" style="width: 100%; padding: 12px; border: none; outline: none;">
                            <div style="display: flex; gap: 10px; width: 100%;">
                                <input type="text" placeholder="MM/YY" value="12/26" style="flex:1; padding: 12px; border: none; outline: none;">
                                <input type="text" placeholder="CVV" value="123" style="flex:1; padding: 12px; border: none; outline: none;">
                            </div>
                        </div>
                    </div>
                    
                    <!-- Pay Button -->
                    <button class="pay-button" onclick="processPayment()">
                        Pay ₹<span id="payAmount">450</span>
                    </button>
                    
                    <!-- Security Info -->
                    <div class="security-info">
                        <span>🔒 Secured by PhonePe</span>
                        <span>⚡ 2 min delivery</span>
                    </div>
                </div>
            </div>
            
            <!-- Transaction Status (Hidden initially) -->
            <div id="statusContent" style="display: none;">
                <!-- Will be filled by JavaScript -->
            </div>
        </div>

        <script>
            // Get URL parameters
            const params = new URLSearchParams(window.location.search);
            const workerId = params.get('workerId') || 'DEL-123';
            const workerName = params.get('name') || 'Raj Kumar';
            const amount = params.get('amount') || '450';
            const reason = params.get('reason') || 'Insurance payout';
            
            // Update display
            document.getElementById('workerNameDisplay').textContent = workerName;
            document.getElementById('workerIdDisplay').textContent = 'ID: ' + workerId;
            document.getElementById('amountDisplay').textContent = '₹' + amount;
            document.getElementById('reasonDisplay').textContent = reason;
            document.getElementById('payAmount').textContent = amount;
            
            let selectedMethod = 'upi';
            
            // Select payment method
            window.selectMethod = function(method) {
                selectedMethod = method;
                
                // Update UI
                document.querySelectorAll('.method-item').forEach(el => {
                    el.classList.remove('selected');
                });
                event.target.closest('.method-item').classList.add('selected');
                
                // Show/hide sections
                document.getElementById('upiSection').style.display = method === 'upi' ? 'block' : 'none';
                document.getElementById('cardSection').style.display = method === 'card' ? 'block' : 'none';
            };
            
            // Reset to payment view
            window.resetToPayment = function() {
                document.getElementById('mainContent').style.display = 'block';
                document.getElementById('statusContent').style.display = 'none';
            };
            
            // Process payment
            window.processPayment = async function() {
                const payBtn = document.querySelector('.pay-button');
                payBtn.disabled = true;
                payBtn.textContent = 'Processing...';
                
                // Simulate UPI verification
                setTimeout(async () => {
                    // 95% success rate
                    const success = Math.random() < 0.95;
                    
                    if (success) {
                        const transactionId = 'TXN' + Date.now().toString().slice(-8) + Math.random().toString(36).substring(2, 6).toUpperCase();
                        const referenceId = 'UPI' + Math.random().toString(36).substring(2, 10).toUpperCase();
                        
                        // Show success screen
                        document.getElementById('mainContent').style.display = 'none';
                        document.getElementById('statusContent').style.display = 'block';
                        
                        document.getElementById('statusContent').innerHTML = `
                            <div class="transaction-status success">
                                <div class="status-icon">✅</div>
                                <div class="status-title">Payment Successful</div>
                                <div class="status-message">₹${amount} paid to ${workerName}</div>
                                
                                <div class="transaction-details">
                                    <div class="detail-row">
                                        <span class="detail-label">Transaction ID</span>
                                        <span class="detail-value">${transactionId}</span>
                                    </div>
                                    <div class="detail-row">
                                        <span class="detail-label">Reference</span>
                                        <span class="detail-value">${referenceId}</span>
                                    </div>
                                    <div class="detail-row">
                                        <span class="detail-label">Date & Time</span>
                                        <span class="detail-value">${new Date().toLocaleString()}</span>
                                    </div>
                                    <div class="detail-row">
                                        <span class="detail-label">Payment Method</span>
                                        <span class="detail-value">UPI (${selectedMethod})</span>
                                    </div>
                                </div>
                                
                                <button class="done-button" onclick="window.close()">Done</button>
                            </div>
                        `;
                        
                        // Send to backend
                        fetch('/api/callback', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({
                                workerId: workerId,
                                amount: amount,
                                transactionId: transactionId,
                                status: 'success',
                                referenceId: referenceId
                            })
                        });
                        
                    } else {
                        // Show failure
                        document.getElementById('mainContent').style.display = 'none';
                        document.getElementById('statusContent').style.display = 'block';
                        
                        document.getElementById('statusContent').innerHTML = `
                            <div class="transaction-status failed">
                                <div class="status-icon">❌</div>
                                <div class="status-title">Payment Failed</div>
                                <div class="status-message">Your transaction could not be processed</div>
                                
                                <div class="transaction-details">
                                    <div class="detail-row">
                                        <span class="detail-label">Reason</span>
                                        <span class="detail-value">Insufficient balance</span>
                                    </div>
                                    <div class="detail-row">
                                        <span class="detail-label">Amount</span>
                                        <span class="detail-value">₹${amount}</span>
                                    </div>
                                    <div class="detail-row">
                                        <span class="detail-label">Time</span>
                                        <span class="detail-value">${new Date().toLocaleTimeString()}</span>
                                    </div>
                                </div>
                                
                                <button class="done-button" onclick="resetToPayment()">Try Again</button>
                            </div>
                        `;
                    }
                    
                    payBtn.disabled = false;
                    payBtn.textContent = 'Pay ₹' + amount;
                }, 2000);
            };
        </script>
    </body>
    </html>
    """

# ============================================
# 2. API for your teammate to trigger payment
# ============================================
@app.route('/api/trigger-payment', methods=['POST'])
def trigger_payment():
    data = request.json
    worker_id = data.get('workerId')
    amount = data.get('amount')
    name = data.get('name', 'Worker')
    reason = data.get('reason', 'Insurance payout')
    
    payment_link = f"http://localhost:5000/pay?workerId={worker_id}&name={name}&amount={amount}&reason={reason}"
    
    print(f"💰 Payment triggered for {worker_id}: ₹{amount}")
    print(f"🔗 Link: {payment_link}")
    
    return jsonify({
        'success': True,
        'payment_link': payment_link,
        'worker_id': worker_id,
        'amount': amount
    })

# ============================================
# 3. Callback from payment page
# ============================================
@app.route('/api/callback', methods=['POST'])
def payment_callback():
    data = request.json
    transactions.append({
        'workerId': data.get('workerId'),
        'amount': data.get('amount'),
        'transactionId': data.get('transactionId'),
        'referenceId': data.get('referenceId'),
        'status': data.get('status'),
        'timestamp': datetime.now().isoformat()
    })
    print(f"✅ Payment recorded: {data.get('workerId')} - ₹{data.get('amount')} - {data.get('status')}")
    return jsonify({'success': True})

# ============================================
# 4. Check transaction history
# ============================================
@app.route('/api/transactions/<worker_id>', methods=['GET'])
def get_transactions(worker_id):
    worker_transactions = [t for t in transactions if t['workerId'] == worker_id]
    return jsonify({
        'worker_id': worker_id,
        'transactions': worker_transactions
    })

# ============================================
# 5. Admin dashboard
# ============================================
@app.route('/api/admin', methods=['GET'])
def admin_dashboard():
    successful = [t for t in transactions if t['status'] == 'success']
    total = sum(float(t['amount']) for t in successful)
    
    return jsonify({
        'total_transactions': len(transactions),
        'successful': len(successful),
        'total_paid': total,
        'recent': transactions[-10:]
    })

# ============================================
# Start server
# ============================================
if __name__ == '__main__':
    print("\n" + "="*50)
    print("📱 PHONEPE STYLE PAYMENT GATEWAY")
    print("="*50)
    print("📍 Payment Page: http://localhost:5000/pay")
    print("📍 Trigger API: POST http://localhost:5000/api/trigger-payment")
    print("\n📝 Test with:")
    print('curl -X POST http://localhost:5000/api/trigger-payment -H "Content-Type: application/json" -d "{\\"workerId\\":\\"DEL-123\\",\\"name\\":\\"Raj\\",\\"amount\\":450,\\"reason\\":\\"Heavy Rain\\"}"')
    print("="*50)
    app.run(port=5000, debug=True)