
import cliProgress from 'cli-progress';
import { getThreadsToProcess, parseThread } from './../email-reader.js';
import { uploadThread } from './../gdrive.js';

const searchForNewEmailsToProcess = async () => {
    try {
        isParsingEmails = true;
        console.log('\n \n🔍 Searching for new emails to process...');
        const emailsToProcess = await getThreadsToProcess();

        if (emailsToProcess.length === 0) {
            console.log('✅ There is no emails to process right now.');
            isParsingEmails = false
            return;
        }else{
            console.log(`📨 We found ${emailsToProcess.length} emails to process.`);
        }

        const parseds = [];
        const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

        console.log(`📩 Downloading email conversation, attachments and creating PDFs... \n`);

        progressBar.start(emailsToProcess.length, 0);
        for  (const email of emailsToProcess) {
            const parsed = await parseThread(email.threadId);
            parseds.push(parsed);
            progressBar.increment();
        }
        progressBar.stop();

        console.log(`\n📤 Uploading conversations to the Google Drive folder... \n`);

        progressBar.start(parseds.length, 0);
        for (const parsed of parseds) {
            await uploadThread(parsed.threadId);
            progressBar.increment();
        }
        progressBar.stop();
        
        console.log(`\n✅ Finished processing ${parseds.length} emails. \n`);
        isParsingEmails = false;
    } catch(err) {
        console.error('\n\n❌ An error has been produced:', err);
        isParsingEmails = false;
    }
}

let isParsingEmails = false;
const initiateWatcher = async () => {
    console.log('📢 Emails listener has been started...');
    setInterval(async () => {
        if (!isParsingEmails){
            await searchForNewEmailsToProcess();
        }
    }, 60000);
    await searchForNewEmailsToProcess();
}


//Make a permanent process that every 1 minute, trigger an function:
//await initiateWatcher();


console.log('Running script...');
await searchForNewEmailsToProcess();