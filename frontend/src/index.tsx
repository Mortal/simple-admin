import * as React from "react";
import * as ReactDOM from "react-dom";
import { Store, createStore, applyMiddleware } from 'redux';
import { Provider, connect } from 'react-redux';
import { mainReducer, IMainState } from './reducers'
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider';
import getMuiTheme from 'material-ui/styles/getMuiTheme';
import * as injectTapEventPlugin from 'react-tap-event-plugin'
import { Statuses } from './statuses'
import * as State from '../../shared/state';
import { IAction, ACTION, IFetchObject, IAlert, CONNECTION_STATUS, ISetConnectionStatus, IRequestAuthStatus } from '../../shared/actions'
import * as $ from "jquery";
import * as page from './page'

import { Object } from './object'
import { Menu } from './menu'
import { ObjectList } from './objectList'
import CircularProgress from 'material-ui/CircularProgress';
import { Messages } from './messages';
import { remoteHost } from './config';
import { Deployment } from './deployment';
import { DeploymentDetails } from './deploymentDetails';
import { add, clear } from './deployment/log';
import Dialog from 'material-ui/Dialog';
import { debugStyle } from './debug'
import * as Cookies from 'js-cookie';
import { Login } from './login';

injectTapEventPlugin();

interface Props {
    page: State.IPage;
    type?: string;
}

function never(n: never, message: string) {
    console.error(message);
}


function mapStateToProps(s: IMainState) {
    let ans: Props = { page: s.page };
    if (ans.page.type == State.PAGE_TYPE.ObjectList)
        ans.type = s.types[ans.page.objectType].content.plural;
    return ans;
}

function MainPageImpl(props: Props) {
    const p = props.page;
    switch (p.type) {
        case State.PAGE_TYPE.Dashbord:
            return <div style={debugStyle()}>
                <h1>Dashboard</h1>
                <Messages />
                <Statuses />
            </div>;
        case State.PAGE_TYPE.ObjectList:
            return <div style={debugStyle()}><h1>List of {props.type}</h1><ObjectList type={p.objectType} /></div>
        case State.PAGE_TYPE.Object:
            return <div style={debugStyle()}><Object type={p.objectType} id={p.id} version={p.version} /> </div>
        case State.PAGE_TYPE.Deployment:
            return <div style={debugStyle()}><Deployment /></div>
        case State.PAGE_TYPE.DeploymentDetails:
            return <div style={debugStyle()}><DeploymentDetails index={p.index} /></div>
        default:
            never(p, "Unhandled page type");
    }
}

export let MainPage = connect(mapStateToProps)(MainPageImpl);

export interface ActionTarget {
    handle: (action: IAction) => boolean;
}

const actionTargets: { [action: number]: ActionTarget[] } = {};

export function addActionTarget(action: ACTION, target: ActionTarget) {
    if (!(action in actionTargets)) actionTargets[action] = [];
    actionTargets[action].push(target);
}

export function removeActionTarget(action: ACTION, target: ActionTarget) {
    actionTargets[action] = actionTargets[action].filter((t) => t !== target);
}

export function sendMessage(action: IAction) {
    socket.send(JSON.stringify(action));
}

const handleRemote = (store: Store<IMainState>) => (next: (a: IAction) => any) => (action: IAction) => {
    switch (action.type) {
        case ACTION.SetPage:
            switch (action.page.type) {
                case State.PAGE_TYPE.Object:
                    const objects = store.getState().objects;
                    if (!(action.page.id in objects) || !(1 in objects[action.page.id].versions)) {
                        let a: IFetchObject = {
                            type: ACTION.FetchObject,
                            id: action.page.id
                        };
                        sendMessage(a);
                    }
                    break;
            }
            break;
        case ACTION.SaveObject:
            action.obj = store.getState().objects[action.id].current;
            sendMessage(action);
            break;
        case ACTION.DeployObject:
        case ACTION.DeleteObject:
        case ACTION.StopDeployment:
        case ACTION.StartDeployment:
        case ACTION.CancelDeployment:
        case ACTION.PokeService:
        case ACTION.MessageTextReq:
            sendMessage(action);
            return;
        case ACTION.ToggleDeploymentObject:
            if (action.source == "webclient") {
                sendMessage(action);
                return;
            }
            break;
        case ACTION.SetMessagesDismissed:
            if (action.source == "webclient") {
                sendMessage(action);
                return;
            }
            break;
        case ACTION.Login:
            sendMessage(action);
            break;
        case ACTION.Logout:
            sendMessage(action);
            if (action.forgetOtp) Cookies.remove("simple-admin-session");
            break;
        case ACTION.Alert:
            alert(action.message);
            return;
    }
    return next(action);
}


const store = createStore(mainReducer, applyMiddleware(handleRemote as any)) as Store<IMainState>;

let socket: WebSocket;
let reconnectTime = 1;

const setupSocket = () => {
    if (reconnectTime < 1000 * 10)
        reconnectTime = reconnectTime * 2;
    store.dispatch({ type: ACTION.SetConnectionStatus, status: CONNECTION_STATUS.CONNECTING });
    socket = new WebSocket('wss://' + remoteHost + '/sysadmin');
    socket.onmessage = data => {
        const loaded = store.getState().loaded;
        const d = JSON.parse(data.data) as IAction;
        if (d.type in actionTargets) {
            for (const t of actionTargets[d.type])
                if (t.handle(d))
                    return;
        }

        if (d.type == ACTION.ClearDeploymentLog) {
            clear();
            return;
        }

        if (d.type == ACTION.AddDeploymentLog) {
            add(d.bytes);
            return;
        }

        store.dispatch(d);
        switch (d.type) {
            case ACTION.AuthStatus:
                if (d.session !== null)
                    Cookies.set("simple-admin-session", d.session, { secure: true, expires: 365 });
                if (d.otp && d.pwd) {
                    sendMessage({ type: ACTION.RequestInitialState });
                }
                break;
            case ACTION.SetInitialState:
                reconnectTime = 1;
                for (const b of (d.deploymentLog || []))
                    add(b);
                if (!loaded)
                    store.dispatch({
                        type: ACTION.SetPage,
                        page: page.get()
                    })
                break
        }
    };

    socket.onopen = () => {
        store.dispatch({ type: ACTION.SetConnectionStatus, status: CONNECTION_STATUS.AUTHENTICATING });
        let msg: IRequestAuthStatus = { type: ACTION.RequestAuthStatus, session: Cookies.get("simple-admin-session") };
        sendMessage(msg);
    }

    socket.onclose = () => {
        store.dispatch({ type: ACTION.SetConnectionStatus, status: CONNECTION_STATUS.WAITING });
        socket = null;
        setTimeout(() => setupSocket(), reconnectTime);
    };
};

setupSocket();

window.onpopstate = (e) => {
    let page = e.state as State.IPage;
    store.dispatch({
        type: ACTION.SetPage,
        page: page
    });
};

interface PropsC {
    status: CONNECTION_STATUS;
    loaded: boolean;
}

function ContentImpl(p: PropsC) {
    let dialog: JSX.Element = null;
    if (p.status != CONNECTION_STATUS.INITED) {
        dialog = <Login />;

    }
    if (p.loaded) {
        return (<div style={debugStyle()}>
            <Menu />
            <div style={{ marginLeft: "300px" }}>
                <MainPage />
            </div>
            {dialog}
        </div>)
    } else {
        return dialog;
    }
}

function mapStateToPropsC(state: IMainState): PropsC {
    return { status: state.connectionStatus, loaded: state.loaded };
}

export let Content = connect(mapStateToPropsC)(ContentImpl);

ReactDOM.render(
    <div>
        <MuiThemeProvider>
            <Provider store={store}>
                <Content />
            </Provider>
        </MuiThemeProvider>
    </div>, document.getElementById("main"));
