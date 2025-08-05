"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const whatsapp_1 = __importDefault(require("./routes/whatsapp"));
const whatsappService_1 = __importDefault(require("./services/whatsappService"));
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = parseInt(process.env.PORT || '3000', 10);
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Serve static files
app.use(express_1.default.static(path_1.default.join(__dirname, '../frontend')));
// API routes
app.use('/api/whatsapp', whatsapp_1.default);
// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, '../frontend/index.html'));
});
// Initialize WhatsApp service
whatsappService_1.default.initialize().catch(console.error);
// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
