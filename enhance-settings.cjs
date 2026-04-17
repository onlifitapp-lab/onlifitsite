const fs = require('fs');
const cheerio = require('cheerio');

const bookingsHtml = fs.readFileSync('bookings.html', 'utf8');
const $ = cheerio.load(bookingsHtml);

// 1. Replace the "Address" input with our new Mode & Location fields
const addressDiv = $('#address').parent();
addressDiv.replaceWith(`
<div class="col-span-1 md:col-span-2">
    <label class="block text-sm font-semibold mb-2">Training Mode</label>
    <div class="flex gap-4 mb-4">
        <label class="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="training_mode" value="online" class="text-primary focus:ring-primary w-4 h-4" checked onchange="toggleLocationFields()">
            <span>Online Only</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="training_mode" value="offline" class="text-primary focus:ring-primary w-4 h-4" onchange="toggleLocationFields()">
            <span>Offline (In-Person)</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="training_mode" value="both" class="text-primary focus:ring-primary w-4 h-4" onchange="toggleLocationFields()">
            <span>Both (Online & Offline)</span>
        </label>
    </div>
</div>

<div id="location-fields" class="col-span-1 md:col-span-2 grid md:grid-cols-2 gap-6 hidden">
    <div>
        <label class="block text-sm font-semibold mb-2">City</label>
        <input type="text" id="city" placeholder="e.g. Mumbai" class="w-full px-4 py-3 border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all">
    </div>
    <div>
        <label class="block text-sm font-semibold mb-2">State</label>
        <input type="text" id="state" placeholder="e.g. Maharashtra" class="w-full px-4 py-3 border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all">
    </div>
    <div class="md:col-span-2">
        <label class="block text-sm font-semibold mb-2">Full Address / Gym Location</label>
        <textarea id="address" rows="2" placeholder="Where do you train your offline clients?" class="w-full px-4 py-3 border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all"></textarea>
    </div>
</div>
`);

// 2. Add the JS logic to load and save these fields
// We will replace the relevant JS segments in the script block
let htmlStr = $.html();

htmlStr = htmlStr.replace("document.getElementById('address').value = settingsUser.address || '';", 
`
document.getElementById('address').value = settingsUser.address || '';
const mode = settingsUser.training_mode || 'online';
const rb = document.querySelector(\`input[name="training_mode"][value="\${mode}"]\`);
if (rb) rb.checked = true;
document.getElementById('city').value = settingsUser.city || '';
document.getElementById('state').value = settingsUser.state || '';
toggleLocationFields();
`);

htmlStr = htmlStr.replace("address: document.getElementById('address').value,",
`
address: document.getElementById('address').value,
training_mode: document.querySelector('input[name="training_mode"]:checked').value,
city: document.getElementById('city').value,
state: document.getElementById('state').value,
`);

// Inject toggleLocationFields function into the script
const scriptIdx = htmlStr.lastIndexOf('</script>');
htmlStr = htmlStr.substring(0, scriptIdx) + `
function toggleLocationFields() {
    const mode = document.querySelector('input[name="training_mode"]:checked').value;
    const locFields = document.getElementById('location-fields');
    if (mode === 'offline' || mode === 'both') {
        locFields.classList.remove('hidden');
    } else {
        locFields.classList.add('hidden');
    }
}
` + htmlStr.substring(scriptIdx);

fs.writeFileSync('bookings.html', htmlStr);
console.log('Done injecting new settings fields');
