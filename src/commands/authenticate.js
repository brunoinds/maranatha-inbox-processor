import 'dotenv/config';
import { requestAuthorization } from './../google-auth.js';

await requestAuthorization();