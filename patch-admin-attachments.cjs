const fs = require('fs');
let code = fs.readFileSync('admin-dashboard.html', 'utf8');

const s1 = `                                  <span style="font-size: 11px; color: #666;">\${new Date(m.created_at).toLocaleString('en-IN')}</span>
                              </div>
                              <p style="font-size: 13px; color: #333; margin: 0; white-space: pre-wrap;">\${m.message}</p>
                          </div>`;

const s2 = `                                  <span style="font-size: 11px; color: #666;">\${new Date(m.created_at).toLocaleString('en-IN')}</span>
                              </div>
                              <p style="font-size: 13px; color: #333; margin: 0; white-space: pre-wrap;">\${m.message}</p>
                              \${m.ticket_attachments && m.ticket_attachments.length > 0 ? \`<div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #E2E8F0;"><strong style="font-size: 12px; color: #4A5568;">Attachments:</strong><div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px;">\${m.ticket_attachments.map(a => \`<a href="\${a.file_url}" target="_blank" style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; background: #FFF; border: 1px solid #CBD5E0; border-radius: 4px; font-size: 11px; text-decoration: none; color: #2B6CB0;"><span class="material-symbols-outlined" style="font-size: 14px;">attachment</span>\${a.file_name}</a>\`).join('')}</div></div>\` : ''}
                          </div>`;

// First replace the query
code = code.replace(
  '*,\\r\\n                          sender:sender_id(name, role)',
  '*,\\r\\n                          sender:sender_id(name, role),\\r\\n                          ticket_attachments:ticket_attachments(*)'
);


code = code.replace(s1, s2);
fs.writeFileSync('admin-dashboard.html', code);
console.log('Done rendering attachments!');
