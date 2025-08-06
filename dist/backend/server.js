"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const whatsapp_1 = __importDefault(require("./routes/whatsapp"));
const telegram_1 = __importDefault(require("./routes/telegram"));
const auth_1 = __importDefault(require("./routes/auth"));
const whatsappService_1 = __importDefault(require("./services/whatsappService"));
const telegramService_1 = __importDefault(require("./services/telegramService"));
const databaseService_1 = __importDefault(require("./services/databaseService"));
const auth_2 = require("./middleware/auth");
const app = (0, express_1.default)();
const PORT = parseInt(process.env.PORT || '3000', 10);
app.use((0, cors_1.default)({
    origin: true,
    credentials: true
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.static(path_1.default.join(__dirname, '../../src/frontend')));
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.version
    });
});
app.use('/api/auth', auth_1.default);
app.use('/api/whatsapp', whatsapp_1.default);
app.use('/api/telegram', telegram_1.default);
app.get('/login', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, '../../src/frontend/login.html'));
});
app.get('/admin', auth_2.checkAuth, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.redirect('/login');
    }
    res.sendFile(path_1.default.join(__dirname, '../../src/frontend/admin.html'));
});
app.get('/', (req, res) => {
    res.redirect('/login');
});
app.get('/dashboard', auth_2.checkAuth, (req, res) => {
    res.sendFile(path_1.default.join(__dirname, '../../src/frontend/index.html'));
});
app.use((req, res) => {
    res.status(404).send('Page not found');
});
async function initializeServices() {
    try {
        await databaseService_1.default.initialize();
        await databaseService_1.default.testConnection();
        console.log('Database connected successfully');
    }
    catch (dbError) {
        console.warn('Database connection failed (continuing without database):', dbError instanceof Error ? dbError.message : 'Unknown error');
    }
    try {
        await whatsappService_1.default.initialize();
        console.log('WhatsApp service initialized');
    }
    catch (whatsappError) {
        console.warn('WhatsApp initialization failed:', whatsappError instanceof Error ? whatsappError.message : 'Unknown error');
    }
    try {
        await telegramService_1.default.initialize();
        console.log('Telegram service initialized successfully');
    }
    catch (telegramError) {
        console.error('Telegram initialization failed:', telegramError instanceof Error ? telegramError.message : 'Unknown error');
    }
    console.log('Service initialization completed');
}
initializeServices();
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
