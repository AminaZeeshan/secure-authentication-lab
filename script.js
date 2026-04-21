// --- Database ---
// Default admin password is plain "admin" so the brute-force wordlist can crack it
let usersDB = {
    "admin": {
        hash: "admin",
        plainPass: "admin",   // stored so rainbow attack can re-hash on-the-fly
        salt: "",
        salted: false,
        locked: false
    }
};

// Wordlist that includes "admin" so brute force will eventually succeed
const BRUTE_WORDLIST = [
    "pass1", "pass2", "pass3", "123456", "password",
    "admin123", "letmein", "qwerty", "abc123", "admin", "root", "test"
];

let failedAttempts = 0;
let lockedAccounts = {};
let auditLog = [];
let bruteRunning = false;

// --- STATS ---
let stats = {
    totalAttempts: 0,
    successCount: 0,
    failedCount: 0,
    blockedCount: 0,
    attackCount: 0,
    registrations: 0
};

function updateStats() {
    document.getElementById('stat-total').innerText   = stats.totalAttempts;
    document.getElementById('stat-success').innerText = stats.successCount;
    document.getElementById('stat-failed').innerText  = stats.failedCount;
    document.getElementById('stat-blocked').innerText = stats.blockedCount;
    document.getElementById('stat-attack').innerText  = stats.attackCount;
    document.getElementById('stat-reg').innerText     = stats.registrations;
    const rate = stats.totalAttempts > 0
        ? Math.round((stats.successCount / stats.totalAttempts) * 100) : 0;
    document.getElementById('stat-rate').innerText = rate + "%";
}

// =============================================
// 1. PASSWORD STRENGTH METER
// =============================================
function checkStrength(password) {
    const hints = {
        len:     password.length >= 8,
        upper:   /[A-Z]/.test(password),
        num:     /[0-9]/.test(password),
        special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };

    const score = Object.values(hints).filter(Boolean).length;

    const fill  = document.getElementById('strength-fill');
    const label = document.getElementById('strength-label');

    const levels = {
        0: { width: '0%',   color: '#333',    text: 'Password strength' },
        1: { width: '25%',  color: '#e94560', text: '🔴 Weak' },
        2: { width: '50%',  color: '#f1c40f', text: '🟡 Fair' },
        3: { width: '75%',  color: '#4cc9f0', text: '🔵 Good' },
        4: { width: '100%', color: '#2ecc71', text: '🟢 Strong' }
    };

    fill.style.width      = levels[score].width;
    fill.style.background = levels[score].color;
    label.innerText       = levels[score].text;
    label.style.color     = levels[score].color;

    document.getElementById('hint-len').classList.toggle('hint-ok', hints.len);
    document.getElementById('hint-upper').classList.toggle('hint-ok', hints.upper);
    document.getElementById('hint-num').classList.toggle('hint-ok', hints.num);
    document.getElementById('hint-special').classList.toggle('hint-ok', hints.special);

    return score;
}

// =============================================
// 2. ATTACK SIMULATOR
// =============================================
function simulateSQL() {
    document.getElementById('signin-form').classList.remove('hidden');
    document.getElementById('signup-form').classList.add('hidden');
    document.querySelectorAll('.tab-btn')[0].classList.add('active');
    document.querySelectorAll('.tab-btn')[1].classList.remove('active');

    const target = document.getElementById('login-user').value.trim();
    if (!target) {
        alert("⚠️ Please type a target username in the login field first, then run the SQL Injection attack!");
        document.getElementById('login-user').focus();
        return;
    }

    // Inject SQL payload into both the username and password fields
    document.getElementById('login-user').value = target + "' OR '1'='1";
    document.getElementById('login-pass').value = "' OR '1'='1";

    flashField('login-user');
    flashField('login-pass');

    setTimeout(() => login(), 600);
}

// Brute Force: keeps trying wordlist until SUCCESS (no protection) or BLOCKED (protection on)
async function simulateBrute() {
    if (bruteRunning) return;
    bruteRunning = true;

    document.getElementById('signin-form').classList.remove('hidden');
    document.getElementById('signup-form').classList.add('hidden');
    document.querySelectorAll('.tab-btn')[0].classList.add('active');
    document.querySelectorAll('.tab-btn')[1].classList.remove('active');

    const target = document.getElementById('login-user').value.trim();
    if (!target) {
        bruteRunning = false;
        alert("⚠️ Please type a target username in the login field first, then run the Brute Force attack!");
        document.getElementById('login-user').focus();
        return;
    }
    if (!usersDB[target]) {
        bruteRunning = false;
        alert(`⚠️ User "${target}" was not found in the database!\n\nPlease register via Sign Up first, then run the attack.`);
        return;
    }

    const progressWrap = document.getElementById('brute-progress-wrap');
    const bruteMsg     = document.getElementById('brute-msg');
    const bruteBar     = document.getElementById('brute-bar-inner');

    progressWrap.style.display = 'block';
    bruteBar.style.width = '0%';
    bruteBar.style.background = '#e94560';
    bruteMsg.style.color = '#f1c40f';
    bruteMsg.innerText = `Target: "${target}" — initiating wordlist attack...`;

    for (let i = 0; i < BRUTE_WORDLIST.length; i++) {
        const pw = BRUTE_WORDLIST[i];
        await new Promise(resolve => setTimeout(resolve, 650));

        document.getElementById('login-user').value = target;
        document.getElementById('login-pass').value = pw;
        flashField('login-pass');

        const pct = Math.round(((i + 1) / BRUTE_WORDLIST.length) * 100);
        bruteBar.style.width = pct + '%';
        bruteMsg.innerText = `Trying: "${pw}"  (${i + 1}/${BRUTE_WORDLIST.length})`;

        const result = await login(target, pw);

        if (result === "success") {
            bruteMsg.innerText = `✅ Password cracked: "${pw}" — ACCESS GRANTED!`;
            bruteMsg.style.color = '#2ecc71';
            bruteBar.style.background = '#2ecc71';
            alert(`🚨 BRUTE FORCE SUCCESS!\n\nTarget: "${target}"\nPassword cracked: "${pw}"\n\nThis happened because Brute-Force Protection is OFF.\nEnable it to prevent this attack!`);
            break;
        } else if (result === "locked") {
            bruteMsg.innerText = `🛡️ Blocked after ${failedAttempts} attempts — Protection worked!`;
            bruteMsg.style.color = '#e94560';
            break;
        }
        // if failed and no protection is active → continue looping
    }

    bruteRunning = false;
    setTimeout(() => {
        progressWrap.style.display = 'none';
        bruteMsg.style.color = '#f1c40f';
        bruteBar.style.background = '#e94560';
        bruteBar.style.width = '0%';
        bruteMsg.innerText = 'Trying passwords...';
    }, 4000);
}


// =============================================
// ATTACK 3: RAINBOW TABLE ATTACK
// Compute the victim (admin) user's hash on-the-fly
// Salt OFF  → hash will be found in the rainbow table  → SUCCESS
// Salt ON   → salted hash won't exist in the table      → FAIL
// =============================================
const RAINBOW_TABLE = {
    "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918": "admin",
    "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8": "password",
    "ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f": "password123",
    "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3": "123",
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad": "abc",
    "65e84be33532fb784c48129675f9eff3a682b27168c0ea744b2cf58ee02337c5": "qwerty",
    "0b14d501a594442a01c6859541bcb3e8164d183d32937b851835442f69d5c94e": "password1",
};

async function simulateRainbowTable() {
    const useHash = document.getElementById('hashing-type').value !== 'none';

    // Switch to Sign In tab
    document.getElementById('signin-form').classList.remove('hidden');
    document.getElementById('signup-form').classList.add('hidden');
    document.querySelectorAll('.tab-btn')[0].classList.add('active');
    document.querySelectorAll('.tab-btn')[1].classList.remove('active');

    if (!useHash) {
        updateStatus("⚠️ Hashing is OFF — passwords are visible as plain text in the database; no rainbow table needed!", "#f1c40f");
        addLog("attacker", "Rainbow Table Attempt", "SKIPPED");
        alert("⚠️ Hashing is OFF!\n\nPasswords are stored as plain text — an attacker doesn't even need a rainbow table!\n\nPlease enable SHA-256 hashing first.");
        return;
    }

    // Attack the username currently entered in the login field
    const victim = document.getElementById('login-user').value.trim();

    if (!victim) {
        alert("⚠️ Please type a target username in the login field first, then run the Rainbow Table attack!");
        document.getElementById('login-user').focus();
        return;
    }

    if (!usersDB[victim]) {
        alert(`⚠️ User "${victim}" was not found in the database!\n\nPlease register via Sign Up first, then run the attack.`);
        return;
    }

    // Use the victim's stored hash as-is — do not modify the database
    const storedHash = usersDB[victim].hash;
    const isSalted   = usersDB[victim].salted;

    const progressWrap = document.getElementById('brute-progress-wrap');
    const bruteMsg     = document.getElementById('brute-msg');
    const bruteBar     = document.getElementById('brute-bar-inner');

    progressWrap.style.display = 'block';
    bruteBar.style.width = '0%';
    bruteBar.style.background = '#a78bfa';
    bruteMsg.style.color = '#a78bfa';
    bruteMsg.innerText = `Target: "${victim}" | Hash: ${storedHash.substring(0, 26)}...`;

    await new Promise(r => setTimeout(r, 800));

    // Salt ON: scan the table — no match will be found
    if (isSalted) {
        const rainbowEntries = Object.entries(RAINBOW_TABLE);
        for (let i = 0; i < rainbowEntries.length; i++) {
            await new Promise(r => setTimeout(r, 300));
            const [tableHash] = rainbowEntries[i];
            const pct = Math.round(((i + 1) / rainbowEntries.length) * 100);
            bruteBar.style.width = pct + '%';
            bruteMsg.innerText = `Checking ${i + 1}/${rainbowEntries.length}: ${tableHash.substring(0, 22)}... ❌`;
        }

        bruteMsg.innerText = `🛡️ No hash matched — the salt successfully blocked the attack!`;
        bruteMsg.style.color = '#2ecc71';
        bruteBar.style.background = '#2ecc71';
        updateStatus(`🛡️ SALT ON — "${victim}"'s salted hash does not exist in the rainbow table!`, "#2ecc71");
        addLog(victim, "Rainbow Table Attempt", "BLOCKED");

        setTimeout(() => {
            alert(`🛡️ RAINBOW TABLE ATTACK FAILED!\n\nTarget: "${victim}"\nStored Hash: ${storedHash.substring(0, 40)}...\n\nThis hash is not in the table because:\n✅ Password + Unique Salt = Completely different hash\n✅ Every user gets a distinct hash\n✅ Pre-computed tables are completely useless!\n\nSalting = Death of Rainbow Tables! ☠️`);
        }, 300);

        setTimeout(() => {
            progressWrap.style.display = 'none';
            bruteMsg.style.color = '#f1c40f';
            bruteBar.style.background = '#e94560';
            bruteBar.style.width = '0%';
            bruteMsg.innerText = 'Trying passwords...';
        }, 5000);
        return;
    }

    // Salt OFF: match the stored hash directly against the rainbow table
    const rainbowEntries = Object.entries(RAINBOW_TABLE);
    let cracked = false;

    for (let i = 0; i < rainbowEntries.length; i++) {
        await new Promise(r => setTimeout(r, 400));
        const [tableHash, plainPw] = rainbowEntries[i];
        const pct = Math.round(((i + 1) / rainbowEntries.length) * 100);
        bruteBar.style.width = pct + '%';
        bruteMsg.innerText = `Checking ${i + 1}/${rainbowEntries.length}: ${tableHash.substring(0, 22)}...`;

        if (tableHash === storedHash) {
            document.getElementById('login-pass').value = plainPw;
            flashField('login-user');
            flashField('login-pass');

            bruteMsg.innerText = `✅ MATCH! SHA-256 of "${plainPw}" equals the stored hash → CRACKED!`;
            bruteMsg.style.color = '#2ecc71';
            bruteBar.style.background = '#2ecc71';
            updateStatus(`🌈 RAINBOW TABLE HIT! "${victim}"'s password cracked: "${plainPw}"`, "#a78bfa");
            addLog(victim, "Rainbow Table Attack", "ATTACK");
            stats.attackCount++;
            updateStats();

            setTimeout(() => {
                alert(`🚨 RAINBOW TABLE ATTACK SUCCESS!\n\nTarget: "${victim}"\nStored Hash: ${storedHash.substring(0, 36)}...\nCracked Password: "${plainPw}"\n\nWhy did this happen?\n❌ Salt was OFF — the password hash stays fixed every time\n❌ The attacker matched it directly from a pre-computed table\n\nFix: Enable Salt → the same password will produce a different hash every time!`);
            }, 300);
            cracked = true;
            break;
        }
    }

    if (!cracked) {
        bruteMsg.innerText = `No match found in the rainbow table.`;
        bruteMsg.style.color = '#f1c40f';
        updateStatus(`"${victim}"'s hash was not found in the table — uncommon or strong password.`, "#2ecc71");
        addLog(victim, "Rainbow Table Attempt", "FAILED");
    }

    setTimeout(() => {
        progressWrap.style.display = 'none';
        bruteMsg.style.color = '#f1c40f';
        bruteBar.style.background = '#e94560';
        bruteBar.style.width = '0%';
        bruteMsg.innerText = 'Trying passwords...';
    }, 5000);
}


function flashField(id) {
    const el = document.getElementById(id);
    el.style.borderColor = '#e94560';
    el.style.boxShadow   = '0 0 10px #e94560';
    setTimeout(() => {
        el.style.borderColor = '';
        el.style.boxShadow   = '';
    }, 500);
}

// =============================================
// 3. EXPORT CSV
// =============================================
function exportCSV() {
    if (auditLog.length === 0) {
        alert("No log entries to export.");
        return;
    }
    const headers = ["Timestamp", "Username", "IP Address", "Action", "Status"];
    const rows = auditLog.map(e =>
        [e.timestamp, e.username, e.ip, e.action, e.status]
            .map(v => `"${v}"`).join(",")
    );
    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit_log_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// =============================================
// AUDIT LOG
// =============================================
function getSimulatedIP() {
    const ips = ["192.168.1.10", "10.0.0.5", "172.16.0.3", "192.168.0.22", "10.10.1.8"];
    return ips[Math.floor(Math.random() * ips.length)];
}

function addLog(username, action, status) {
    const now       = new Date();
    const timestamp = now.toLocaleString('en-PK', { hour12: true });
    const ip        = getSimulatedIP();
    const entry     = { timestamp, username: username || "unknown", action, status, ip };
    auditLog.unshift(entry);
    renderAuditLog();

    if (action === "Login Attempt") stats.totalAttempts++;
    if (status === "SUCCESS" && action === "Login Attempt") stats.successCount++;
    if (status === "FAILED") stats.failedCount++;
    if (status === "BLOCKED" && action !== "SQL Injection Attempt") stats.blockedCount++;
    if (status === "ATTACK" || action === "SQL Injection Attempt") {
        stats.attackCount++;
        if (action === "SQL Injection Attempt") stats.totalAttempts++;
    }
    if (status === "REGISTERED") stats.registrations++;
    updateStats();
}

function renderAuditLog() {
    const logBody = document.getElementById('audit-log-body');
    if (!logBody) return;
    logBody.innerHTML = "";
    if (auditLog.length === 0) {
        logBody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#555;padding:20px;">No activity recorded yet.</td></tr>`;
        return;
    }
    auditLog.forEach(entry => {
        const row = document.createElement('tr');
        let sc = "";
        if (entry.status === "SUCCESS")     sc = "log-success";
        else if (entry.status === "FAILED")     sc = "log-failed";
        else if (entry.status === "BLOCKED")    sc = "log-blocked";
        else if (entry.status === "ATTACK")     sc = "log-attack";
        else if (entry.status === "REGISTERED") sc = "log-success";
        row.innerHTML = `
            <td>${entry.timestamp}</td>
            <td>${entry.username}</td>
            <td>${entry.ip}</td>
            <td>${entry.action}</td>
            <td><span class="log-badge ${sc}">${entry.status}</span></td>
        `;
        logBody.appendChild(row);
    });
}

function clearAuditLog() {
    auditLog = [];
    renderAuditLog();
}

// =============================================
// LOCKED ACCOUNTS
// =============================================
function lockAccount(username) {
    lockedAccounts[username] = true;
    renderLockedAccounts();
}

function manualUnlock(username) {
    delete lockedAccounts[username];
    failedAttempts = 0;
    document.querySelector("#signin-form button").disabled = false;
    addLog(username, "Manual Unlock by Admin", "SUCCESS");
    updateStatus("🔓 Account Unlocked by Admin", "#2ecc71");
    renderLockedAccounts();
}

function renderLockedAccounts() {
    const list = document.getElementById('locked-accounts-list');
    if (!list) return;
    list.innerHTML = "";
    const locked = Object.keys(lockedAccounts);
    if (locked.length === 0) {
        list.innerHTML = `<div class="no-locked">✅ No locked accounts</div>`;
        return;
    }
    locked.forEach(username => {
        const item = document.createElement('div');
        item.className = 'locked-item';
        item.innerHTML = `
            <span>🔒 <strong>${username}</strong></span>
            <button class="unlock-btn" onclick="manualUnlock('${username}')">Unlock</button>
        `;
        list.appendChild(item);
    });
}

// =============================================
// UTILITY
// =============================================
async function hashData(text) {
    const encoder    = new TextEncoder();
    const data       = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray  = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function showForm(type) {
    document.getElementById('signin-form').classList.toggle('hidden', type !== 'signin');
    document.getElementById('signup-form').classList.toggle('hidden', type !== 'signup');
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

function detectSQL(input) {
    const patterns = [/'/, /;/, /--/, /OR 1=1/i, /DROP/i, /SELECT/i];
    return patterns.some(p => p.test(input));
}

function updateDBView() {
    const dbView = document.getElementById('db-view');
    dbView.innerHTML = "";
    for (let user in usersDB) {
        const entry = document.createElement('div');
        entry.className = 'db-entry';
        const hashDisplay = usersDB[user].hash.length > 32
            ? usersDB[user].hash.substring(0, 32) + "..."
            : usersDB[user].hash;
        entry.innerHTML = `<strong>User:</strong> ${user}<br>
                           <strong>Hash:</strong> ${hashDisplay}<br>
                           <strong>Salted:</strong> ${usersDB[user].salted ? "YES" : "NO"}`;
        dbView.appendChild(entry);
    }
}

function updateStatus(msg, color) {
    const s = document.getElementById('status-display');
    s.innerText   = msg;
    s.style.color = color;
}

// Show/hide brute info box when toggle changes
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('brute-force-protect').addEventListener('change', function () {
        document.getElementById('brute-info-box').style.display = this.checked ? 'none' : 'block';
    });
});

window.onload = () => {
    updateDBView();
    renderAuditLog();
    renderLockedAccounts();
    updateStats();
};

// =============================================
// SIGN UP
// =============================================
async function signup() {
    const user    = document.getElementById('reg-user').value;
    const pass    = document.getElementById('reg-pass').value;
    const useHash = document.getElementById('hashing-type').value !== 'none';
    const useSalt = document.getElementById('salt-protect').checked;

    if (!user || !pass) { alert("Please fill all fields"); return; }

    const score = checkStrength(pass);
    if (score < 2) {
        const proceed = confirm("⚠️ WEAK PASSWORD WARNING!\n\nThe password '" + pass + "' is very weak.\nIt can be easily cracked via rainbow table or brute force.\n\nDo you still want to register for demo purposes?");
        if (!proceed) return;
    }

    let finalPass = pass;
    let userSalt  = "";
    if (useSalt) userSalt = crypto.randomUUID();
    if (useHash || useSalt) {
        finalPass = await hashData(useSalt ? pass + userSalt : pass);
    }

    // Store plainPass so the rainbow table attack demo can also target this user
    usersDB[user] = { hash: finalPass, plainPass: pass, salted: useSalt, salt: userSalt, locked: false };
    updateDBView();
    document.getElementById('status-display-signup').innerText   = `User ${user} saved to database.`;
    document.getElementById('status-display-signup').style.color = '#2ecc71';
    addLog(user, "User Registration", "REGISTERED");
}

// =============================================
// LOGIN — returns result string for brute force loop
// =============================================
async function login(overrideUser, overridePass) {
    const user         = overrideUser !== undefined ? overrideUser : document.getElementById('login-user').value;
    const pass         = overridePass !== undefined ? overridePass : document.getElementById('login-pass').value;
    const protectionOn = document.getElementById('sql-protect').checked;

    // SQL Injection check
    if (!protectionOn) {
        if (user.includes("' OR '1'='1") || pass.includes("' OR '1'='1")) {
            updateStatus("⚠️ VULNERABILITY EXPLOITED: SQL Injection Bypass!", "#f1c40f");
            addLog(user, "SQL Injection (Exploited)", "ATTACK");
            alert("Hacked! Access Granted via SQL Injection.");
            return "attack";
        }
    } else {
        if (detectSQL(user) || detectSQL(pass)) {
            updateStatus("🛡️ ATTACK BLOCKED: SQL Injection Prevented.", "#e94560");
            addLog(user, "SQL Injection Attempt", "BLOCKED");
            alert("Security Alert: Malicious SQL patterns detected and blocked.");
            return "blocked";
        }
    }

    // Brute Force protection — only lock if protection is ON
    const bfOn = document.getElementById('brute-force-protect').checked;
    if (bfOn && failedAttempts >= 3) {
        updateStatus("🚫 SYSTEM LOCKED (Brute Force)", "#e94560");
        addLog(user, "Brute Force - Account Locked", "BLOCKED");
        lockAccount(user || "unknown");
        document.querySelector("#signin-form button").disabled = true;
        setTimeout(() => {
            if (lockedAccounts[user]) { delete lockedAccounts[user]; renderLockedAccounts(); }
            failedAttempts = 0;
            document.querySelector("#signin-form button").disabled = false;
            updateStatus("🔓 Account Auto-Unlocked", "#4cc9f0");
            addLog(user, "Account Auto-Unlocked", "SUCCESS");
        }, 10000);
        return "locked";
    }

    // Normal Auth
    const useHash = document.getElementById('hashing-type').value !== 'none';
    const useSalt = document.getElementById('salt-protect').checked;
    let inputPass = pass;

    if (usersDB[user]) {
        const storedSalt = usersDB[user].salt || "";
        if (useHash || useSalt) {
            inputPass = await hashData(useSalt ? pass + storedSalt : pass);
        }
    }

    if (usersDB[user] && usersDB[user].hash === inputPass) {
        updateStatus("✅ ACCESS GRANTED", "#2ecc71");
        addLog(user, "Login Attempt", "SUCCESS");
        failedAttempts = 0;
        return "success";
    } else {
        failedAttempts++;
        const noProtMsg = !bfOn ? " — No protection active, will keep trying!" : ` (${failedAttempts}/3)`;
        updateStatus(`❌ ACCESS DENIED${noProtMsg}`, "#f1c40f");
        addLog(user, "Login Attempt", "FAILED");
        return "failed";
    }
}