import {Request, Response} from 'express';
import {db} from './instances'
import {randomBytes} from 'crypto';
import {config} from './config';
import * as crypt from './crypt'
import { IObject2 } from '../../shared/state';
import { IAction, ACTION, IObjectChanged} from '../../shared/actions'
import { webClients} from './instances'


export default async (req: Request, res: Response) => {
    res.type("text/x-shellscript");
    let host = req.param("host");
    let token = req.param("token");
    if (!host) {
        res.status(405).send("#!/bin/bash\necho \"Missing hostname\"\n");
        return;
    }
    let ho = await db.getHostContentByName(host);
    if (!ho || !ho.content || (ho.content as any).password !== token) {
        res.status(406).send("#!/bin/bash\necho \"Invalid\"\n");
    }

    let npw = randomBytes(18).toString('base64');
    let cpw = await crypt.hash(npw);
    let obj: IObject2<any> = {
        id: ho.id, 
        type: ho.type, 
        name: ho.name,
        catagory: ho.catagory,
        comment: ho.comment,
        content: {...ho.content, password: cpw},
        version: ho.version
    };

    let { id, version } = await db.changeObject(obj.id, obj);
    obj.version = version;
    obj.id = id;
    let act: IObjectChanged = {type: ACTION.ObjectChanged, id: ho.id, object: [obj]};
    webClients.broadcast(act);

    let script = "#!/bin/bash\n";
    script += "set -e\n";
    script += "add-apt-repository universe\n";
    script += "apt update\n";
    script += "apt install -y python3 python3-dbus git\n";
    script += "echo '{\"password\": \""+npw+"\", \"server_host\": \""+config.hostname+"\", \"hostname\": \""+host+"\"}' > /etc/simpleadmin_client.json\n";
    script += "rm -rf /opt/simple-admin\n";
    script += "mkdir -p /opt/simple-admin\n";
    script += "git clone https://github.com/antialize/simple-admin.git /opt/simple-admin\n";
    script += "cp /opt/simple-admin/simpleadmin-client.service /etc/systemd/system\n";
    script += "systemctl daemon-reload\n";
    script += "systemctl enable simpleadmin-client.service\n";
    script += "systemctl restart simpleadmin-client.service\n";
    script += "systemctl status simpleadmin-client.service\n";
    script += "echo 'Done'\n";
    res.send(script);
};