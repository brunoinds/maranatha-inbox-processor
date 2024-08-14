import { getOAuth2Client } from "./google-auth.js";
import { google } from 'googleapis';
import fs from 'fs';
import { errorThread, finalizeThread } from "./email-reader.js";
import 'dotenv/config';

const folderIdToUpload = process.env.DRIVE_FOLDER_ID;

const drive = google.drive({ version: 'v3' });


export async function uploadThread(threadId){
    const oAuth2Client = getOAuth2Client();
    const createThreadFolder = async (folderName) => {
        const folder = await drive.files.create({
            resource: {
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [folderIdToUpload]
            },
            fields: 'id',
            auth: oAuth2Client
        })

        return folder.data.id;
    }
    const uploadFile = async (folderId, fileName, filePath, mimeType) => {
        const fileMetadata = {
            name: fileName,
            parents: [folderId]
        };

        const media = {
            mimeType: mimeType,
            body: fs.createReadStream(filePath)
        };

        const file = await drive.files.create({
            resource: fileMetadata,
            media: media,
            auth: oAuth2Client
        });

        return file.data;
    }
    const deleteThread = async (threadId) => {
        const threadFolderPath = 'threads/' + threadId;
        fs.rmSync(threadFolderPath, { recursive: true });
    }


    //Upload file to folder:
    const threadDataFilePath = 'threads/' + threadId + '/thread.json';
    const threadData = JSON.parse(fs.readFileSync(threadDataFilePath));

    try {
        const attachmentsToUpload = threadData.attachments.map((attachment) => {
            return {
                fileName: attachment.fileName,
                mimeType: attachment.mimeType,
                filePath: 'threads/' + threadId + '/' + attachment.fileNameForPath
            }
        });
        const conversationPdfToUpload = {
            fileName: threadData.snippet,
            mimeType: 'application/pdf',
            filePath: 'threads/' + threadId + '/conversation.pdf'
        }
    
        const folderId = await createThreadFolder(threadData.snippet);
        
        //Upload conversation pdf:
        await uploadFile(folderId, conversationPdfToUpload.fileName, conversationPdfToUpload.filePath, conversationPdfToUpload.mimeType);
    
        //Upload attachments, in Promise.all:
        await Promise.all(attachmentsToUpload.map((attachment) => {
            return uploadFile(folderId, attachment.fileName, attachment.filePath, attachment.mimeType);
        }));
        deleteThread(threadId);
        finalizeThread(threadData, folderId);
        return threadData;
    } catch (error) {
        errorThread(threadData, error);
        throw Error(error);
    }
}