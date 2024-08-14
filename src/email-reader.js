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

export async function getThreadsToProcess(){
    try {
        google.options({auth: getOAuth2Client()});

        let inboxItems = [];

        const threadsList = await gmail.users.threads.list({
            userId: userId,
            maxResults: 60,
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
    const inboxItem = {
        threadId: threadId,
        snippet: null,
        messages: [],
        attachments: [],
        date: null
    };
    try {        
        google.options({auth: getOAuth2Client()});

        fs.mkdirSync(`threads/${threadId}`, { recursive: true });
        const fullThread = await gmail.users.threads.get({
            userId: userId,
            id: threadId
        });

        // Step 3: Process the thread
        inboxItem.snippet = fullThread.data.messages[0].snippet;

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
        errorThread(inboxItem, err);
        throw Error(err);
    }
}

export async function finalizeThread(threadData, uploadedFolderId){
    //Send email to first email in thread, sending all has been processed:
    const currentTimeNow = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const message = `El correo "${threadData.snippet}" ha sido procesado con éxito a las ${currentTimeNow}. Los archivos se encuentran disponibles en https://drive.google.com/drive/folders/${uploadedFolderId}`;

    const raw = Buffer.from(
        `From: ${userId}\r\n` +
        `To: ${userId}\r\n` +
        `Subject: Correo Procesado con Exito\r\n` +
        `Content-Type: text/html; charset=utf-8\r\n` +
        `\r\n` +
        `${message}`
    ).toString('base64');

    await gmail.users.messages.send({
        userId: userId,
        requestBody: {
            raw
        }
    });

    const parsedThreads = JSON.parse(fs.readFileSync(`threads/threads.json`));
    parsedThreads.push({ threadId: threadData.threadId });
    fs.writeFileSync(`threads/threads.json`, JSON.stringify(parsedThreads));

    return;
}

export async function errorThread(threadData, error){
    //Send email to first email in thread, sending all has been processed:
    const currentTimeNow = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const message = `Infelizmente hubo un error al intentar procesar el correo "${threadData.snippet}" (threadId: ${threadData.threadId}) a las ${currentTimeNow}. Aqui están los detalles del error:
<hr>
<p>Thread:</p>
<pre>
${JSON.stringify(threadData, null, 2).replaceAll(toParseMessage, '<toParseMessage removed>')}
</pre>

<hr>
<p>Error:</p>
<pre>
${error} ${error.stack}
</pre>
`;

    const raw = Buffer.from(
        `From: ${userId}\r\n` +
        `To: ${userId}\r\n` +
        `Subject: Error al Procesar Correo\r\n` +
        `Content-Type: text/html; charset=utf-8\r\n` +
        `\r\n` +
        `${message}`
    ).toString('base64');

    await gmail.users.messages.send({
        userId: userId,
        requestBody: {
            raw
        }
    });
    return;
}