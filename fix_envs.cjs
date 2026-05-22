const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if (file.endsWith('.js')) results.push(file);
        }
    });
    return results;
}

const apiFiles = walk(path.join(__dirname, 'api'));

apiFiles.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    // Only modify if it imports supabase and doesn't already have dotenv
    if (content.includes('@supabase/supabase-js') && !content.includes('dotenv')) {
        content = content.replace(
            "import { createClient } from '@supabase/supabase-js';",
            "import { createClient } from '@supabase/supabase-js';\nimport dotenv from 'dotenv';\n\ndotenv.config({ path: '.env.local' });"
        );
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Updated: ${file}`);
    }
});
console.log('Done replacing env injections!');
