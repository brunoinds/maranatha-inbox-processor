# Maranatha Inbox Processor

## Overview
Maranatha Inbox Processor is a Node.js application designed to fetch, read and process emails from a Gmail account. It fetches email messages, attachment, and upload them into an Google Drive folder. It also extracts email headers such as From, To, Subject, and Date, retrieves the entire message history in a conversation, and decodes and processes email bodies, including HTML content.

## Features

- Fetches email messages from a Gmail account.
- Extracts email headers such as From, To, Subject, and Date.
- Downloads email attachments and uploads them to a Google Drive folder.

## Installation

1. Clone the repository:
    ```sh
    git clone https://github.com/yourusername/maranatha-inbox-processor.git
    cd maranatha-inbox-processor
    ```

2. Install dependencies:
    ```sh
    npm install
    ```

## Usage

1. Set up your Gmail API credentials. Follow the instructions [here](https://developers.google.com/gmail/api/quickstart/nodejs) to create a project and obtain the necessary credentials.

2. Create a `.env` file in the root directory and add your Gmail API credentials:
    ```env
    GOOGLE_CLIENT_ID = your_google_client_id
    GOOGLE_CLIENT_SECRET = your_google_client_secret
    CALLBACK_URL="http://localhost:3000/auth/google/callback"
    DRIVE_FOLDER_ID='your_drive_folder_id'
    TO_PARSE_MESSAGE_TRIGGER='your_trigger_message'
    ```

3. The `TO_PARSE_MESSAGE_TRIGGER` is a string that will be used to identify the email messages that need to be processed. The application will only process email messages that contain this string in the email body.

4. Run the application for first time (make OAuth login):
    ```sh
    npm run login
    ```

5. Run the application listener to watch for new emails:
    ```sh
    npm run start
    ```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.