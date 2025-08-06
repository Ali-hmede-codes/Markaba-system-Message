const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

async function testTelegramBot() {
    console.log('Testing Telegram Bot Configuration...');
    console.log('Bot Token:', process.env.TELEGRAM_BOT_TOKEN ? 'Present' : 'Missing');
    console.log('Channel ID:', process.env.TELEGRAM_CHANNEL_ID);
    
    if (!process.env.TELEGRAM_BOT_TOKEN) {
        console.error('❌ TELEGRAM_BOT_TOKEN is missing');
        return;
    }
    
    if (!process.env.TELEGRAM_CHANNEL_ID) {
        console.error('❌ TELEGRAM_CHANNEL_ID is missing');
        return;
    }
    
    try {
        // Initialize bot
        const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
        
        // Test 1: Get bot info
        console.log('\n1. Testing bot connection...');
        const botInfo = await bot.getMe();
        console.log('✅ Bot connected successfully:');
        console.log('   - Username:', botInfo.username);
        console.log('   - First Name:', botInfo.first_name);
        console.log('   - ID:', botInfo.id);
        
        // Test 2: Get chat info
        console.log('\n2. Testing channel access...');
        try {
            const chatInfo = await bot.getChat(process.env.TELEGRAM_CHANNEL_ID);
            console.log('✅ Channel found:');
            console.log('   - Title:', chatInfo.title);
            console.log('   - Type:', chatInfo.type);
            console.log('   - ID:', chatInfo.id);
        } catch (chatError) {
            console.error('❌ Channel access failed:', chatError.message);
            console.log('\n🔍 Possible issues:');
            console.log('   1. Bot is not added to the channel');
            console.log('   2. Bot is not an administrator');
            console.log('   3. Channel ID format is incorrect');
            console.log('   4. Channel is private and bot lacks access');
        }
        
        // Test 3: Send test message
        console.log('\n3. Testing message sending...');
        try {
            const message = await bot.sendMessage(process.env.TELEGRAM_CHANNEL_ID, '🧪 Test message from bot - ' + new Date().toISOString());
            console.log('✅ Test message sent successfully!');
            console.log('   - Message ID:', message.message_id);
        } catch (sendError) {
            console.error('❌ Message sending failed:', sendError.message);
            
            if (sendError.message.includes('chat not found')) {
                console.log('\n🔧 Solutions for "chat not found" error:');
                console.log('   1. Add bot as administrator to the channel');
                console.log('   2. Grant "Send Messages" permission to the bot');
                console.log('   3. Verify channel ID format (should start with -100 for private channels)');
                console.log('   4. Try using @channelname format if it\'s a public channel');
            }
        }
        
    } catch (error) {
        console.error('❌ Bot initialization failed:', error.message);
        
        if (error.message.includes('401')) {
            console.log('\n🔧 Bot token is invalid. Please check:');
            console.log('   1. Token is correct and complete');
            console.log('   2. Bot was created properly with @BotFather');
            console.log('   3. No extra spaces or characters in token');
        }
    }
}

// Run the test
testTelegramBot().catch(console.error);