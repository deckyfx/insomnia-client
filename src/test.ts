// CHANGELOG: [2025-06-04] - Updated to import and start the interactive CLI interface

import { FileCacheDriver } from "./cache-drivers";
import { FileCookieDriver } from "./cookie-drivers";
import { InsomniaClient } from "./insomnia-client";

//import { startInteractiveCLI } from "./interactive";

// Start the interactive CLI interface
//startInteractiveCLI();

const client = new InsomniaClient();
client.loadConfig("./insomnia.yaml");
client.setCookieDriver(new FileCookieDriver(".interactive.cookie"));
client.setCacheDriver(new FileCacheDriver(".interactive.cache"));
const data = await client.request("API/User/Get User Detail");
console.log(data);
