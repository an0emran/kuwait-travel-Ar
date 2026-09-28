
import XLSX from 'xlsx';
import fs from 'fs';

try {
    const workbook = XLSX.readFile('مجموعات انس.xlsx');
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet).slice(0, 5);
    console.log(JSON.stringify(data, null, 2));
} catch (err) {
    console.error('Error reading excel:', err.message);
}
