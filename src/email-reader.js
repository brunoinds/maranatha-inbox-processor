import { getOAuth2Client, getSession } from "./google-auth.js";
import { google } from 'googleapis';
import fs from 'fs';
import puppeteer from "puppeteer";
import mime from 'mime-types';
import { generateHtml } from "./email-pdf.js";
import 'dotenv/config';


const toParseMessage = process.env.TO_PARSE_MESSAGE_TRIGGER;
const gmail = google.gmail('v1');



const userId = getSession().email;

/*
export async function getEmails() {
    try {        
        google.options({auth: getOAuth2Client()});
        
        const inboxItems = [];

        const threadsList = await gmail.users.threads.list({
            userId: userId,
            q: `in:inbox label:testes` //has:attachment label:testes
        });

        // Step 2: Fetch full thread details for each thread
        for (const thread of threadsList.data.threads) {
            fs.mkdirSync(`threads/${thread.id}`, { recursive: true });

            const fullThread = await gmail.users.threads.get({
                userId: userId,
                id: thread.id
            });

            // Step 3: Process the thread
            const inboxItem = {
                threadId: thread.id,
                snippet: fullThread.data.messages[0].snippet,
                relatedEmails: new Set(),
                messages: []
            };

            //Process messages
            for (const message of fullThread.data.messages) {
                const headers = message.payload.headers;
                const from = headers.find(header => header.name === 'From').value;
                const to = headers.find(header => header.name === 'To').value;
                const date = headers.find(header => header.name === 'Date').value;




                //As the message.payload.parts each part can include .parts (recursive), should get the bodyHtml recursively:
                function getBodyHtml(payload) {
                    let bodyHtml = '';
                
                    if (payload.parts) {
                        for (const part of payload.parts) {
                            if (part.mimeType === 'text/html' && part.body.data) {
                                bodyHtml += Buffer.from(part.body.data, 'base64').toString();
                            } else if (part.parts) {
                                bodyHtml += getBodyHtml(part);
                            }
                        }
                    } else if (payload.body && payload.body.data) {
                        bodyHtml = Buffer.from(payload.body.data, 'base64').toString();
                    }
                
                    return bodyHtml;
                }

                const bodyHtml = getBodyHtml(message.payload);

                //Process attachments:
                const attachmentDetails = message.payload.parts
                .filter((msgPart) => msgPart.body.attachmentId);

                const attachments = [];

                
                for (const attachmentDetail of attachmentDetails) {
                    const attachment = await gmail.users.messages.attachments.get({
                        id: attachmentDetail.body.attachmentId,
                        messageId: message.id,
                        userId: userId
                    });

                    const fileName = attachmentDetail.filename;
                    const attachmentData = Buffer.from(attachment.data.data, 'base64');
                    const fileNameSanitized = sanitizeFilename(fileName);
                    const fileNameForPath = `${attachmentDetail.body.attachmentId.substring(0, 10)}.${mime.extension(attachmentDetail.mimeType)}`;
                    
                    fs.writeFileSync(`threads/${thread.id}/${fileNameForPath}`, attachmentData);

                    attachments.push({
                        fileName,
                        mimeType: attachmentDetail.mimeType,
                        fileNameSanitized,
                        fileNameForPath,
                        id: attachmentDetail.body.attachmentId
                    });
                }
                inboxItem.messages.push({ from, to, date, bodyHtml, attachments });
            }

            
            



            //Create an PDF file with all messages in thread, using puppeteer:
            const browser = await puppeteer.launch();
            const page = await browser.newPage();
            await page.setContent(inboxItem.messages.reverse().map((message) => message.bodyHtml).join('<hr>'));
            await page.pdf({ path: `threads/${thread.id}/conversation.pdf`, format: 'A4' });
            await browser.close();

            fs.writeFileSync(`threads/${thread.id}/thread.json`, JSON.stringify(inboxItem, null, 2));
            
            inboxItems.push(inboxItem);
        }

        return inboxItems;

        fs.writeFileSync('inbox.json', JSON.stringify(inboxItems, null, 2));

        return inboxItems;
    } catch(err) {
        console.log(err)
        throw Error(err);
    }
}*/

export async function getThreadsToProcess(){
    try {
        google.options({auth: getOAuth2Client()});

        let inboxItems = [];

        const threadsList = await gmail.users.threads.list({
            userId: userId,
            maxResults: 6,
            q: `` //has:attachment label:testes in:inbox
        });


        // Step 2: Fetch full thread details for each thread
        for (const thread of threadsList.data.threads) {
            const fullThread = await gmail.users.threads.get({
                userId: userId,
                id: thread.id
            });

            // Step 3: Process the thread
            const inboxItem = {
                threadId: thread.id,
                snippet: fullThread.data.messages[0].snippet,
                messages: []
            };

            //Process messages
            for (const message of fullThread.data.messages) {
                const headers = message.payload.headers;
                const from = headers.find(header => header.name === 'From').value;

                function getBodyPlain(payload) {
                    let bodyHtml = '';
                
                    if (payload.parts) {
                        for (const part of payload.parts) {
                            if (part.mimeType === 'text/plain' && part.body.data) {
                                bodyHtml += Buffer.from(part.body.data, 'base64').toString();
                            } else if (part.parts) {
                                bodyHtml += getBodyPlain(part);
                            }
                        }
                    } else if (payload.body && payload.body.data) {
                        bodyHtml = Buffer.from(payload.body.data, 'base64').toString();
                    }
                
                    return bodyHtml;
                }
                const bodyPlain = getBodyPlain(message.payload);

                inboxItem.messages.push({ from, bodyPlain });
            }
            inboxItems.push(inboxItem);
        }

        inboxItems = inboxItems.filter((inboxItem) => {
            const correctAnswers = inboxItem.messages.filter((message) => {
                return message.bodyPlain.includes(toParseMessage);
            })
            return correctAnswers.length > 0;
        });


        fs.mkdirSync(`threads`, { recursive: true });
        if (!fs.existsSync(`threads/threads.json`)){
            fs.writeFileSync(`threads/threads.json`, JSON.stringify([]));
        }
        const parsedThreads = JSON.parse(fs.readFileSync(`threads/threads.json`));
        
        return inboxItems.map((thread) => {
            return {
                ...thread,
                wasParsed: parsedThreads.find((parsedThread) => parsedThread.threadId === thread.threadId) ? true : false
            }
        }).filter((thread) => !thread.wasParsed);
    } catch (error) {
        console.log(error)
        throw Error(error);
    }
}

export async function parseThread(threadId) {
    try {        
        google.options({auth: getOAuth2Client()});

        fs.mkdirSync(`threads/${threadId}`, { recursive: true });
        const fullThread = await gmail.users.threads.get({
            userId: userId,
            id: threadId
        });

        // Step 3: Process the thread
        const inboxItem = {
            threadId: threadId,
            snippet: fullThread.data.messages[0].snippet,
            messages: [],
            attachments: [],
            date: null
        };

        //Process messages
        for (const message of fullThread.data.messages) {
            const headers = message.payload.headers;
            const from = headers.find(header => header.name === 'From').value;
            const to = headers.find(header => header.name === 'To').value;
            const date = headers.find(header => header.name === 'Date').value;

            //As the message.payload.parts each part can include .parts (recursive), should get the bodyHtml recursively:
            function getBodyHtml(payload) {
                let bodyHtml = '';
            
                if (payload.parts) {
                    for (const part of payload.parts) {
                        if (part.mimeType === 'text/html' && part.body.data) {
                            bodyHtml += Buffer.from(part.body.data, 'base64').toString();
                        } else if (part.parts) {
                            bodyHtml += getBodyHtml(part);
                        }
                    }
                } else if (payload.body && payload.body.data) {
                    bodyHtml = Buffer.from(payload.body.data, 'base64').toString();
                }
            
                return bodyHtml;
            }

            const bodyHtml = getBodyHtml(message.payload);

            //Process attachments:
            const attachmentDetails = !message.payload.parts ? [] : message.payload.parts
            .filter((msgPart) => msgPart.body.attachmentId);

            const attachments = [];

            
            for (const attachmentDetail of attachmentDetails) {
                const attachment = await gmail.users.messages.attachments.get({
                    id: attachmentDetail.body.attachmentId,
                    messageId: message.id,
                    userId: userId
                });


                const fileName = attachmentDetail.filename;
                const attachmentData = Buffer.from(attachment.data.data, 'base64');
                const fileNameForPath = `${attachmentDetail.body.attachmentId.substring(0, 10)}.${mime.extension(attachmentDetail.mimeType)}`;
                
                fs.writeFileSync(`threads/${threadId}/${fileNameForPath}`, attachmentData);

                const attachmentDataInfo = {
                    fileName,
                    mimeType: attachmentDetail.mimeType,
                    size: attachmentData.length,
                    fileNameForPath,
                    id: attachmentDetail.body.attachmentId
                }
                attachments.push(attachmentDataInfo);
                inboxItem.attachments.push(attachmentDataInfo);
            }
            inboxItem.messages.push({ from, to, date, bodyHtml, attachments });
        }

        if (inboxItem.messages.length > 0){
            inboxItem.date = inboxItem.messages[0].date;
        }

        //Create an PDF file with all messages in thread, using puppeteer:
        const browser = await puppeteer.launch();
        const page = await browser.newPage();

        const pdfHtml = generateHtml(inboxItem)

        await page.setContent(pdfHtml);
        await page.pdf({ path: `threads/${threadId}/conversation.pdf`, format: 'A4' });
        await browser.close();

        fs.writeFileSync(`threads/${threadId}/thread.json`, JSON.stringify(inboxItem, null, 2));

        return inboxItem;
    } catch(err) {
        console.log(err)

        throw Error(err);
    }
}

export async function finalizeThread(threadData, uploadedFolderId){
    //Send email to first email in thread, sending all has been processed:

    const message = `Procesado ✅. Los archivos se encuentran en https://drive.google.com/drive/folders/${uploadedFolderId}`;


    const raw = Buffer.from(
        `From: ${userId}\r\n` +
        `To: ${threadData.messages[0].from}, ${userId}\r\n` +
        `Subject: Procesado ✅\r\n` +
        `Content-Type: text/html; charset=utf-8\r\n` +
        `\r\n` +
        `${message}`
    ).toString('base64');

    await gmail.users.messages.send({
        userId: userId,
        requestBody: {
            raw,
            threadId: threadData.threadId
        }
    });



    const parsedThreads = JSON.parse(fs.readFileSync(`threads/threads.json`));
    parsedThreads.push({ threadId: threadData.threadId });
    fs.writeFileSync(`threads/threads.json`, JSON.stringify(parsedThreads));

    return;
}