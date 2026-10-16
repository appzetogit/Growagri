const fs = require('fs');
let c = fs.readFileSync('server.js', 'utf8');
const target = "app.use('/api/users/fcm-tokens', require('./routes/user-routes/fcmToken.routes'));";
const replacement = target + "\napp.use('/api/user/referral', require('./routes/user-routes/referral.routes'));";
c = c.replace(target, replacement);
fs.writeFileSync('server.js', c, 'utf8');
console.log('Done');
