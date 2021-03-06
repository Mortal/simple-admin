import * as React from "react";
import 'xterm/dist/xterm.css';
import * as $ from 'jquery'
import Chip from 'material-ui/Chip';
import RaisedButton from 'material-ui/RaisedButton';
import { remoteHost } from './config';
import * as Cookies from 'js-cookie';

declare global {
    const Terminal: any;
}

interface Props {
    id: number;
}

class Connection {
    constructor(hostId: number, public connectionId: number, nameChanged: (id: number, name: string) => void) {
        this.term = new Terminal({ cursorBlink: true, scrollback: 10000 });
        this.termDiv = document.createElement('div');
        this.termDiv.style.height = "100%";
        this.term.open(this.termDiv);
        this.socket = new WebSocket('wss://' + remoteHost + '/terminal?server=' + hostId + '&cols=80&rows=150&session=' + Cookies.get("simple-admin-session"));
        let buffer: string[] = [];

        this.socket.onmessage = (msg) => {
            this.term.write(msg.data);
        }

        this.socket.onopen = () => {
            for (const item of buffer) {
                this.socket.send(item);
            }
            buffer = null;
        };

        let send = (msg: string) => {
            if (buffer === null)
                this.socket.send(msg);
            else
                buffer.push(msg);
        }

        this.term.on('data', (data: string) => {
            send('d' + data + "\0");
        });

        this.term.on('title', (title: string) => {
            this.name = title;
            nameChanged(connectionId, title);
        });
        this.term.on('resize', (size: any) => {
            if (this.oldsize[9] == size.rows && this.oldsize[1] == size.cols) return;
            this.oldsize = [size.rows, size.cols];
            send('r' + size.rows + "," + size.cols + '\0');
        });
    }

    disconnect() {
        this.socket.close();
        delete this.socket;
        delete this.term;
        delete this.termDiv;
    }

    reset() {
        this.term.reset();
    }

    oldsize: [number, number] = [0, 0]
    term?: any;
    termDiv?: HTMLDivElement;
    socket?: WebSocket;
    name: string;
}

class HostInfo {
    next: number = 1;
    cachedCurrent: number = null;
    connections: { [id: number]: Connection } = {}
};

interface State {
    current: number;
    names: { [id: number]: string };
}

export class HostTerminals extends React.Component<Props, State> {
    outerDiv: HTMLDivElement;
    termContainerDiv: HTMLDivElement;
    interval: any;
    state: State = { current: null, names: {} }
    info: HostInfo;
    mounted: boolean = false;

    static hostConnections: { [id: number]: HostInfo } = {};

    constructor(props: Props) {
        super(props);
        if (!(props.id in HostTerminals.hostConnections))
            HostTerminals.hostConnections[props.id] = new HostInfo();
        this.info = HostTerminals.hostConnections[props.id];
        if (Object.keys(this.info.connections).length === 0)
            this.newTerminal();
        else {
            const names: { [id: number]: string } = {};
            for (const id in this.info.connections)
                names[id] = this.info.connections[id].name;
            this.state = { current: this.info.cachedCurrent, names: names };
        }
    }

    newTerminal() {
        let id = this.info.next;
        this.info.next++;

        const name = "Terminal " + id;
        const names = Object.assign({}, this.state.names);
        names[id] = name;

        if (this.mounted) {
            this.setState({ names: names });
            this.setCurrent(id);
        } else
            this.state = { names: names, current: id };
    }

    reset() {
        if (this.state.current === null) return;
        const conn = this.info.connections[this.state.current];
        conn.reset();
    }

    setCurrent(id: number) {
        if (this.state.current !== null) {
            const conn = this.info.connections[this.state.current];
            if (conn && conn.termDiv.parentNode === this.outerDiv) {
                this.outerDiv.removeChild(conn.termDiv);
                clearInterval(this.interval);
            }
        }
        if (id !== null) {
            if (!(id in this.info.connections))
                this.info.connections[id] = new Connection(this.props.id, id, (id: number, name: string) => {
                    let names = Object.assign({}, this.state.names);
                    names[id] = name;
                    this.setState({ names: names });
                })
            const conn = this.info.connections[id];
            conn.name = "Terminal " + id;
            this.outerDiv.appendChild(conn.termDiv);
            conn.term.fit();

            $(window).resize(() => {
                conn.term.fit();
            });
            this.interval = setInterval(() => conn.term.fit(), 2000);
        }
        if (id != this.state.current)
            this.setState({ current: id })
    }

    componentDidMount() {
        this.mounted = true;
        this.setCurrent(this.state.current);
    }

    componentWillUnmount() {
        this.info.cachedCurrent = this.state.current;
        this.setCurrent(null);
        this.mounted = false;

    }

    toggleFullScreen() {
        const d = document as any;
        const fse = d.fullscreenElement || d.webkitFullscreenElement || d.mozFullScreenElement || d.msFullscreenElement || d.webkitFullscreenElement;
        const exit = d.exitFullscreen || d.webkitExitFullscreen || d.mozCancelFullScreen || d.msExitFullscreen || d.webkitExitFullscreen;

        if (!fse) {
            const e = this.outerDiv as any;
            var requestFullScreen = e.requestFullscreen || e.msRequestFullscreen || e.mozRequestFullScreen || e.webkitRequestFullscreen;
            requestFullScreen.call(e);
        } else {
            exit.call(d);
        }
    }

    closeTerminal(id: number) {
        //if (!confirm("Close terminal?")) return;
        const names = Object.assign({}, this.state.names);
        delete names[id];

        let other: number = null;
        for (const id2 in names) other = +id2;
        this.setCurrent(other);
        this.setState({ names: names });

        const conn = this.info.connections[id];
        conn.disconnect();
        delete this.info.connections[id];
    }

    render() {
        let ids = Object.keys(this.state.names).map((v) => +v);
        ids.sort((a, b) => a - b);
        let terms: JSX.Element[] = ids.map(id => {
            let style: React.CSSProperties = { margin: 4 };
            if (id == this.state.current)
                style.backgroundColor = 'rgb(0, 188, 212)';

            return <Chip key={id} style={style} onTouchTap={() => this.setCurrent(id)} onRequestDelete={() => this.closeTerminal(id)}>{this.state.names[id]}</Chip>
        });

        return (
            <div style={{ height: "700px" }}>
                <div ref={(div) => this.outerDiv = div} style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                        {terms}
                        <Chip onTouchTap={() => this.newTerminal()} style={{ margin: 4 }}>+</Chip>
                        <div style={{ marginLeft: 'auto' }} />
                        <RaisedButton onClick={() => this.reset()} label="Reset" style={{ margin: 4, alignSelf: 'flex-end' }} />
                        <RaisedButton onClick={() => this.toggleFullScreen()} label="Full screen" style={{ margin: 4, alignSelf: 'flex-end' }} />
                    </div>
                    <div ref={(div) => this.termContainerDiv = div} style={{ flex: 1 }} />
                </div>
            </div>
        )
    }
}
