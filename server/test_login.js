// Native fetch in Node 18+

async function testLogin() {
    try {
        // 1. Fetch Captcha
        console.log("Fetching Captcha...");
        const captchaRes = await fetch('http://127.0.0.1:5000/api/captcha');
        const captchaData = await captchaRes.json();
        console.log("Captcha Data:", captchaData);

        const { id, question } = captchaData;
        const parts = question.split(' ');
        const num1 = parseInt(parts[0]);
        const operator = parts[1];
        const num2 = parseInt(parts[2]);

        let answer;
        if (operator === '+') answer = num1 + num2;
        else if (operator === '-') answer = num1 - num2;
        else if (operator === '×') answer = num1 * num2; // note the symbol I used in server

        console.log(`Solved Captcha: ${question} = ${answer}`);

        // 2. Login with Captcha
        const response = await fetch('http://127.0.0.1:5000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'admin2@kuwait-travel.com',
                password: 'admin2026',
                captchaId: id,
                captchaAnswer: answer
            })
        });

        const data = await response.json();
        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testLogin();
