document.addEventListener('DOMContentLoaded', () => {
    const insuranceForm = document.getElementById('insuranceForm');

    if (insuranceForm) {
        insuranceForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const submitBtn = document.getElementById('submitBtn');
            if (submitBtn) {
                const btnText = submitBtn.querySelector('.button-text');
                const btnLoader = submitBtn.querySelector('.button-loader');
                if (btnText && btnLoader) {
                    btnText.style.display = 'none';
                    btnLoader.style.display = 'flex';
                }
            }

            // Simulate a brief processing time then redirect
            setTimeout(() => {
                window.location.href = '../html/register.html';
            }, 800);
        });
    }

    // Add a Login / Register link to the top header
    const mainContainer = document.querySelector('.main-container');
    if (mainContainer) {
        const loginContainer = document.createElement('div');
        loginContainer.style.position = 'absolute';
        loginContainer.style.top = '20px';
        loginContainer.style.right = '30px';
        loginContainer.style.zIndex = '100';

        const loginLink = document.createElement('a');
        loginLink.href = '../html/register.html';
        loginLink.textContent = 'Login / Register';
        loginLink.style.color = '#fff';
        loginLink.style.backgroundColor = 'var(--accent-primary, #F97316)';
        loginLink.style.padding = '10px 20px';
        loginLink.style.borderRadius = '8px';
        loginLink.style.textDecoration = 'none';
        loginLink.style.fontWeight = '600';
        loginLink.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
        loginLink.style.transition = 'all 0.3s ease';

        loginLink.onmouseover = () => {
            loginLink.style.transform = 'translateY(-2px)';
            loginLink.style.boxShadow = '0 6px 12px rgba(0, 0, 0, 0.15)';
        };
        loginLink.onmouseout = () => {
            loginLink.style.transform = 'translateY(0)';
            loginLink.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
        };

        loginContainer.appendChild(loginLink);
        document.body.appendChild(loginContainer);
    }
});
