const fs = require('fs');
let code = fs.readFileSync('admin-dashboard.html', 'utf8');

// 1. verifyKYC
code = code.replace(
  "await updateOverallVerificationStatus(trainerId);\r\n\r\n                alert('KYC documents approved!');",
  "await updateOverallVerificationStatus(trainerId);\r\n\r\n                await supabase.from('notifications').insert([{ user_id: trainerId, type: 'alert', title: 'KYC Verified ✅', message: 'Your identity documents have been approved.', read: false }]);\r\n\r\n                alert('KYC documents approved!');"
);

// 2. rejectKYC
code = code.replace(
  "alert('KYC documents rejected');",
  "await supabase.from('notifications').insert([{ user_id: trainerId, type: 'alert', title: 'KYC Rejected ❌', message: 'Your identity documents were rejected. Please review and re-upload.', read: false }]);\r\n                alert('KYC documents rejected');"
);

// 3. verifyCertificates
code = code.replace(
  "await updateOverallVerificationStatus(trainerId);\r\n\r\n                alert('Certificates approved!');",
  "await updateOverallVerificationStatus(trainerId);\r\n\r\n                await supabase.from('notifications').insert([{ user_id: trainerId, type: 'alert', title: 'Certificates Verified ✅', message: 'Your professional certifications have been approved.', read: false }]);\r\n\r\n                alert('Certificates approved!');"
);

// 4. rejectCertificates
code = code.replace(
  "alert('Certificates rejected');",
  "await supabase.from('notifications').insert([{ user_id: trainerId, type: 'alert', title: 'Certificates Rejected ❌', message: 'Your professional certifications were rejected.', read: false }]);\r\n                alert('Certificates rejected');"
);

fs.writeFileSync('admin-dashboard.html', code);
console.log('Successfully injected notifications into Admin Dashboard.');
