import * as fs from 'fs';

import {Job} from '../job'
import * as message from '../messages'
// Type only imports
import {HostClient} from '../hostclient'
import {Deployment} from '../deployment'
import {deployment} from '../instances'

export class DeployJob extends Job {  
    stdoutPart: string = "";
    stderrPart: string = "";

    constructor(hostClient: HostClient, public script: string, public content:any, public cb: (ok:boolean, code:number)=>void) {
        super(hostClient, null, hostClient);
        let msg: message.RunScript = {
            'type': 'run_script', 
            'id': this.id, 
            'name': "deploy.py", 
            'interperter': '/usr/bin/python3', 
            'content': script,
            'args': [],
            'stdin_type': 'given_json',
            'input_json': content,
            'stdout_type': 'binary',
            'stderr_type': 'binary'
        };
        this.client.sendMessage(msg);
        this.running = true;
    }

    handleMessage(obj: message.Incomming) {
        switch(obj.type) {
        case 'data':
            if (obj.source == 'stdout' || obj.source == 'stderr') 
                deployment.addLog(Buffer.from(obj.data, 'base64').toString('binary'))
            break;
        case 'success':
            this.cb(true, obj.code);
            break;    
        case 'failure':
            this.cb(false, -1);
            break;
        }
        super.handleMessage(obj);
    }
};

