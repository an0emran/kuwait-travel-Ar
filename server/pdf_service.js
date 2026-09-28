import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

/**
 * Generate PDF report for pilgrims
 * @param {Array} pilgrims - List of pilgrims
 * @param {String} userName - User name for the report
 * @returns {Buffer} PDF buffer
 */
export function generatePilgrimsPDF(pilgrims, userName = 'Admin') {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: 'A4', margin: 50 });
            const chunks = [];

            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));

            // Header
            doc.fontSize(20).text('تقرير متابعة المعتمرين', { align: 'center' });
            doc.fontSize(12).text(`المسؤول: ${userName}`, { align: 'center' });
            doc.fontSize(10).text(`التاريخ: ${new Date().toLocaleDateString('ar-SA')}`, { align: 'center' });
            doc.moveDown(2);

            // Table Header
            const tableTop = 150;
            const col1 = 50;
            const col2 = 150;
            const col3 = 250;
            const col4 = 350;
            const col5 = 450;

            doc.fontSize(10).font('Helvetica-Bold');
            doc.text('الاسم', col1, tableTop);
            doc.text('الجواز', col2, tableTop);
            doc.text('الوصول', col3, tableTop);
            doc.text('منقضي', col4, tableTop);
            doc.text('متبقي', col5, tableTop);

            doc.moveTo(col1, tableTop + 15).lineTo(550, tableTop + 15).stroke();

            // Table Rows
            let y = tableTop + 25;
            doc.font('Helvetica');

            pilgrims.forEach((p, idx) => {
                // Color based on days remaining
                if (p.days_remaining <= 20) {
                    doc.fillColor('red');
                } else if (p.days_remaining <= 30) {
                    doc.fillColor('orange');
                } else if (p.days_remaining <= 60) {
                    doc.fillColor('gold');
                } else {
                    doc.fillColor('green');
                }

                doc.fontSize(9);
                doc.text(p.name || '', col1, y, { width: 90 });
                doc.text(p.passport_number || '', col2, y, { width: 90 });
                doc.text(new Date(p.arrival_date).toLocaleDateString('ar-SA'), col3, y, { width: 90 });
                doc.text(`${p.days_passed} يوم`, col4, y, { width: 90 });
                doc.text(`${p.days_remaining} يوم`, col5, y, { width: 90 });

                y += 25;

                // New page if needed
                if (y > 700) {
                    doc.addPage();
                    y = 50;
                }

                doc.fillColor('black'); // Reset color
            });

            // Footer
            doc.fontSize(8).fillColor('gray');
            doc.text('الكويت للسفريات والسياحة', 50, 750, { align: 'center' });
            doc.text('هاتف: 776358963', 50, 765, { align: 'center' });

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Send notification to sponsor when pilgrim reaches 70 days
 * @param {Object} pilgrim - Pilgrim data
 * @returns {Boolean} Success status
 */
export async function sendSponsorNotification(pilgrim) {
    // This is a placeholder for SMS/WhatsApp integration
    // You can integrate with Twilio, WhatsApp API, or SMS gateway here
    
    const message = `⚠️ تحذير: المعتمر ${pilgrim.name} (جواز: ${pilgrim.passport_number}) له ${pilgrim.days_passed} يوم في السعودية. متبقي ${pilgrim.days_remaining} يوم فقط!`;
    
    console.log(`📱 إرسال رسالة للضامن ${pilgrim.sponsor_name} (${pilgrim.sponsor_phone}):`);
    console.log(message);
    
    // TODO: Integrate with actual SMS/WhatsApp service
    // Example with Twilio:
    // await twilioClient.messages.create({
    //     body: message,
    //     from: 'YOUR_TWILIO_NUMBER',
    //     to: pilgrim.sponsor_phone
    // });
    
    return true;
}
