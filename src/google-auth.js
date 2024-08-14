import {google} from 'googleapis';
import axios from 'axios';
import 'dotenv/config';
import fs from 'fs';
import express from 'express';
import open from 'open';


const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, CALLBACK_URL } = process.env;

const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    CALLBACK_URL
);

export function getGoogleAuthURL() {
    const scopes = [
        'profile',
        'email',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.compose',
        'https://www.googleapis.com/auth/drive',
    ];

    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: scopes,
    });
}

export async function getGoogleUser({ code }) {
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials({
    refresh_token: tokens.refresh_token
  });

  const googleUser = await axios
    .get(
      `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${tokens.access_token}`,
      {
        headers: {
          Authorization: `Bearer ${tokens.id_token}`,
        },
      },
    )
    .then(res => {
      return { data: res.data, refresh_token: tokens.refresh_token };
    })
    .catch(error => {
        throw new Error(error.message);
    });


    saveSession({token: googleUser.refresh_token, email: googleUser.data.email});
    console.log('✅ ¡Login realizado con éxito!');
    return googleUser;
}

export function getOAuth2Client() {
    const session = getSession();
    const refresh_token = session.token;
    const oAuth2Client = new google.auth.OAuth2(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        CALLBACK_URL
    );
    oAuth2Client.setCredentials({
        refresh_token
    });
    return oAuth2Client;
}

function saveSession(sessionData){
    fs.writeFileSync('secrets/session.json', JSON.stringify({...sessionData}));
}
export function getSession(){
    if (!fs.existsSync('secrets/session.json')) {
        throw new Error('❌ You need to login first.');
    }


    return JSON.parse(fs.readFileSync('secrets/session.json'));
}



export async function requestAuthorization(){
  const app = express();

  app.set('view engine', 'ejs');
  app.use(express.static('public'));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get('/auth/google', (req, res) => {
      res.redirect(getGoogleAuthURL());
  });

  app.get('/auth/google/callback', async(req, res) => {
      try {
          const googleUser = await getGoogleUser(req.query);
      
          res.send('✅ ¡Login realizado con éxito! Ahora puedes cerrar esta ventana y volver a la consola.');
          process.exit();
      } catch(err) {
          res.status(500).json({ error: err.message });
      }
  });



  app.listen(3000, () => console.log('Opening browser on http://localhost:3000/auth/google to login'));

  //Force to open link on browser:
  await open('http://localhost:3000/auth/google');
}