import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Loads all .txt files from the knowledge directory
 * @returns {string} Combined knowledge base content
 */
export function loadKnowledgeBase() {
    const knowledgeDir = path.join(__dirname, 'data', 'knowledge');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(knowledgeDir)) {
        fs.mkdirSync(knowledgeDir, { recursive: true });
        console.log('📁 Created knowledge directory:', knowledgeDir);
        return '';
    }

    try {
        const files = fs.readdirSync(knowledgeDir);
        const txtFiles = files.filter(f => f.endsWith('.txt'));
        
        if (txtFiles.length === 0) {
            console.log('⚠️ No knowledge files found in:', knowledgeDir);
            return '';
        }

        let knowledgeContent = '';
        
        for (const file of txtFiles) {
            const filePath = path.join(knowledgeDir, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            knowledgeContent += `\n--- ${file} ---\n${content}\n`;
        }

        console.log(`✅ Loaded ${txtFiles.length} knowledge file(s)`);
        return knowledgeContent;
        
    } catch (error) {
        console.error('❌ Error loading knowledge base:', error);
        return '';
    }
}

/**
 * Converts numbers in text to spoken Arabic format
 * Example: "776358963" -> "سبعة سبعة ستة ثلاثة خمسة ثمانية تسعة ستة ثلاثة"
 */
export function numbersToArabicWords(text) {
    const digitMap = {
        '0': 'صفر',
        '1': 'واحد',
        '2': 'اثنان',
        '3': 'ثلاثة',
        '4': 'أربعة',
        '5': 'خمسة',
        '6': 'ستة',
        '7': 'سبعة',
        '8': 'ثمانية',
        '9': 'تسعة'
    };

    // Replace sequences of digits with spoken words
    return text.replace(/\d+/g, (match) => {
        // For phone numbers (7+ digits), speak digit by digit
        if (match.length >= 7) {
            return match.split('').map(d => digitMap[d]).join(' ');
        }
        // For smaller numbers, keep as is (will be spoken naturally)
        return match;
    });
}
