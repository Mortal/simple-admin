import { IUpdateStatusAction, IAction, ACTION, IMessage, CONNECTION_STATUS, IAuthStatus} from '../../shared/actions'
import { IStatus, IStatuses, IStatusUpdate, applyStatusUpdate } from '../../shared/status'
import { Reducer, combineReducers } from 'redux';
import { IPage, PAGE_TYPE, IObjectDigest, DEPLOYMENT_STATUS, IDeploymentObject, IObject2 } from '../../shared/state'
import { IType, typeId, TypePropType } from '../../shared/type'

function fillDefaults(content:{[key:string]:any}, type: IType) {
    if (type.hasVariables && !('variables' in content)) content['variables'] = [];
    if (type.hasContains && !('contains' in content))content['contains'] = [];
    if (type.hasSudoOn && !('sudoOn' in content)) content['sudoOn'] = [];
    if (type.hasSudoOn && !('triggers' in content)) content['triggers'] = [];
    if (type.hasDepends && !('depends' in content)) content['depends'] = [];
    for (const item of type.content || []) {
        switch (item.type) {
        case TypePropType.bool:
        case TypePropType.choice:
        case TypePropType.text:
            if (!(item.name in content)) content[item.name] = item.default;
            break;
        case TypePropType.document:
            if (item.langName && !(item.langName in content)) content[item.langName] = "";
            if (!(item.name in content)) content[item.name] = "";
            break;
        case TypePropType.password:
            if (!(item.name in content))
                content[item.name] = Array.from((window as any).crypto.getRandomValues(new Uint8Array(18)), (byte:number) => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
            break;
        case TypePropType.none:
            break;
        case TypePropType.typeContent:
            if (!(item.name in content)) content[item.name] = [];
        }
    }
}
export interface IObjectState {
    current: IObject2<any> | null;
    versions: { [version: number]: IObject2<any> };
    touched: boolean;
}

export interface IDeploymentState {
    status: DEPLOYMENT_STATUS;
    objects: IDeploymentObject[];
    message: string;
}

export interface ILogin {
    user: string;
    pwd: string;
    otp: string;
}

export interface IMainState {
    status: IStatuses;
    page: IPage;
    objectListFilter: { [type: number]: string };
    serviceListFilter: { [host: number]: string };
    objectDigests: { [type: number]: IObjectDigest[] };
    objects: { [id: number]: IObjectState };
    serviceLogVisibility: { [host: number]: { [name: string]: boolean } }
    messages: { [id: number]: IMessage };
    messageExpanded: {[id:number]: boolean};
    messageGroupExpanded: {[id:number]: boolean};
    deployment: IDeploymentState;
    types: {[id:number]: IObject2<IType>};
    connectionStatus: CONNECTION_STATUS;
    loaded: boolean;
    authStatus: IAuthStatus | null;
    login: ILogin;
};

function messages(state: { [id: number]: IMessage } = {}, action: IAction) {
    switch (action.type) {
        case ACTION.SetInitialState: {
            const messages: { [id: number]: IMessage } = {};
            for (const msg of action.messages)
                messages[msg.id] = msg;
            return messages;
        }
        case ACTION.SetMessagesDismissed: {
            const messages = Object.assign({}, state);
            for (const id of action.ids) {
                messages[id] = Object.assign({}, messages[id]);
                messages[id].dismissed = action.dismissed;
            }
            return messages;
        }
        case ACTION.AddMessage: {
            const messages = Object.assign({}, state);
            messages[action.message.id] = action.message;
            return messages;
        }
    }
    return state;
}

function serviceLogVisibility(state: { [host: number]: { [name: string]: boolean } } = {}, action: IAction) {
    switch (action.type) {
        case ACTION.SetServiceLogVisibility:
            const s2 = Object.assign({}, state);
            s2[action.host] = Object.assign({}, s2[action.host] || {});
            s2[action.host][action.service] = action.visibility;
            return s2;
        default:
            return state;
    }
}

function serviceListFilter(state: { [host: number]: string } = {}, action: IAction) {
    switch (action.type) {
        case ACTION.SetServiceListFilter:
            const ns = Object.assign({}, state);
            ns[action.host] = action.filter;
            return ns;
        default:
            return state;
    }
}


function objectDigests(state: { [type: number]: IObjectDigest[] } = {}, action: IAction) {
    switch (action.type) {
        case ACTION.SetInitialState:
            return action.objectNamesAndIds;
        case ACTION.ObjectChanged:
            const s2 = Object.assign({}, state);
            if (action.object.length == 0) {
               for (let cls in s2) {
                    if (s2[cls].findIndex(v => v.id == action.id) == -1) continue;
                    s2[cls] = s2[cls].filter(v=> v.id != action.id);
               }
            } else {
                let version = -1;
                let name = "";
                let catagory = "";
                let type = -1;
                for (const ob of action.object) {
                    if (ob.version < version) continue;
                    version = ob.version;
                    name = ob.name;
                    type = ob.type;
                    catagory = ob.catagory;
                }
                if (!(type in s2)) s2[type] = [];
                else s2[type] = s2[type].filter((v) => v.id != action.id);
                s2[type].push({ id: action.id, name, catagory, type});
            }
            return s2;
        default:
            return state;
    }
}

function types(state: {[id:number]:IObject2<IType>} = {}, action: IAction) {
    switch (action.type) {
    case ACTION.SetInitialState:
        return action.types;
    case ACTION.ObjectChanged:
        if (action.object.length == 0) {
            if (action.id in state) {
                let a = Object.assign({}, state);
                delete a[action.id];
                return a;
            }
        } else if (action.object[action.object.length -1].type == typeId) {
            let x = action.object[action.object.length -1];
            let a = Object.assign({}, state);
            a[x.id] = x;
            return a;
        }
        return state;
    default:
        return state;
    }
}

function objects(state: { [id: number]: IObjectState } = {}, action: IAction): { [id: number]: IObjectState } {
    switch (action.type) {
        case ACTION.ObjectChanged:
            let ret = Object.assign({}, state);
            if (action.object.length == 0) { //The object was deleted
                if (action.id in ret)
                    delete ret[action.id];
            } else {
                if (action.id in ret)
                    ret[action.id].versions = Object.assign({}, ret[action.id].versions);
                else
                    ret[action.id] = { current: null, versions: {}, touched: false };
                for (const obj of action.object)
                    ret[action.id].versions[obj.version] = obj;
            }
            return ret;
        case ACTION.DiscardObject:
            if (!(action.id in state)) return state;
            let ret2 = Object.assign({}, state);
            ret2[action.id] = { current: null, versions: state[action.id].versions, touched: false };
            return ret2;
        case ACTION.SetObjectName:
            if (!(action.id in state)) return state;
            let ret3 = Object.assign({}, state);
            ret3[action.id] = Object.assign({}, ret3[action.id]);
            ret3[action.id].current = Object.assign({}, ret3[action.id].current);
            ret3[action.id].current.name = action.name;
            ret3[action.id].touched = true;
            return ret3;
        case ACTION.SetObjectComment:
            if (!(action.id in state)) return state;
            let ret7 = Object.assign({}, state);
            ret7[action.id] = Object.assign({}, ret7[action.id]);
            ret7[action.id].current = Object.assign({}, ret7[action.id].current);
            ret7[action.id].current.comment = action.comment;
            ret7[action.id].touched = true;
            return ret7;
        case ACTION.SetObjectContentParam:
            if (!(action.id in state)) return state;
            let ret4 = Object.assign({}, state);
            ret4[action.id] = Object.assign({}, ret4[action.id]);
            ret4[action.id].current = Object.assign({}, ret4[action.id].current);
            ret4[action.id].current.content = Object.assign({}, ret4[action.id].current.content);
            (ret4[action.id].current.content as { [key: string]: any })[action.param] = action.value;
            ret4[action.id].touched = true;
            return ret4;
        case ACTION.SaveObject:
            if (!(action.id in state)) return state;
            let ret5 = Object.assign({}, state);
            ret5[action.id] = Object.assign({}, ret5[action.id], {touched: false});
            return ret5;
        case ACTION.SetObjectCatagory:
            if (!(action.id in state)) return state;
            let ret6 = Object.assign({}, state);
            ret6[action.id] = Object.assign({}, ret6[action.id]);
            ret6[action.id].current = Object.assign({}, ret6[action.id].current);
            ret6[action.id].current.catagory = action.catagory;
            ret6[action.id].touched = true;
            return ret6;
        default:
            return state;
    }
}

function objectListFilter(state: { [type: number]: string } = {}, action: IAction) {
    switch (action.type) {
        case ACTION.SetObjectListFilter:
            let x: { [type: number]: string } = {};
            x[action.objectType] = action.filter;
            return Object.assign({}, state, x);
        default:
            return state;
    }
}

function status(state: IStatuses = {}, action: IAction) {
    switch (action.type) {
        case ACTION.UpdateStatus:
            let x: IStatuses = {};
            let old = null;
            if (action.host in state)
                old = state[action.host];
            x[action.host] = applyStatusUpdate(old, action.update);
            x[action.host].up = true;
            return Object.assign({}, state, x);
        case ACTION.HostDown:
            if (!(action.id in state)) return state;
            let y = Object.assign({}, state);
            y[action.id] = Object.assign({}, y[action.id]);
            y[action.id].up = false;
            break;
        case ACTION.SetInitialState:
            return action.statuses;
        default:
            return state;
    }
}

function page(state: IPage = { type: PAGE_TYPE.Dashbord }, action: IAction) {
    switch (action.type) {
        case ACTION.SetPage:
            return action.page;
        default:
            return state;
    }
}

function changeCurrentObject(state: IMainState) {
    if (state.page.type != PAGE_TYPE.Object) return; // We are not viewing an object
    let id = state.page.id;
    let current: IObject2<any> = null;
    if (id >= 0) { // We are modifying an existing object
        if (!(id in state.objects)) return; // The object has not been loaded
        if (state.page.version == null) {
            // We have no version so lets pick the newest
            state.page = Object.assign({}, state.page);
            state.page.version = 1;
            for (let v in state.objects[id].versions)
                state.page.version = Math.max(state.page.version, +v);
        }
        if (state.objects[id].current != null && state.objects[id].current.version == state.page.version)
            return; //We are allready modifying the right object
        current = Object.assign(state.objects[id].versions[state.page.version]);
    } else { // We are modifying a new object
        if (state.page.id in state.objects && state.objects[id].current != null) return; //We are allready modifying the right object
        // We need to create a new object
        current = {id: id, type: state.page.objectType, name:"", version: null, catagory: "", content: {}, comment: ""};
    }

    current.content = Object.assign({}, current.content);
    fillDefaults(current.content, state.types[state.page.objectType].content);

    state.objects = Object.assign({}, state.objects);
    if (id in state.objects)
        state.objects[id] = Object.assign({}, state.objects[id], { current: current });
    else
        state.objects[id] = { touched: false, current: current, versions: {} }
}

export function deployment(state: IDeploymentState = { status: DEPLOYMENT_STATUS.Done, objects: [], message: "" }, action: IAction) {
    switch (action.type) {
        case ACTION.SetDeploymentStatus:
            return Object.assign({}, state, { status: action.status });
        case ACTION.SetDeploymentMessage:
            return Object.assign({}, state, { message: action.message });
        case ACTION.SetDeploymentObjects:
            return Object.assign({}, state, { objects: action.objects });
        case ACTION.SetDeploymentObjectStatus:
            let x = state.objects.slice(0);
            x[action.index] = Object.assign({}, x[action.index], { status: action.status });
            return Object.assign({}, state, { objects: x });
        case ACTION.ToggleDeploymentObject:
            let y = state.objects.slice(0);
            if (action.index === null) {
                for (let o of y) {
                    if (o.enabled == action.enabled) continue;
                    y[o.index] = Object.assign({}, o, { enabled: action.enabled })
                }
            } else {
                y[action.index] = Object.assign({}, y[action.index], { enabled: action.enabled });
            }
            return Object.assign({}, state, { objects: y });
        case ACTION.SetInitialState:
            return { status: action.deploymentStatus, /*log: action.deploymentLog ? action.deploymentLog : [],*/ objects: action.deploymentObjects, message: action.deploymentMessage, logClearCount: 0 };
    }
    return state;
}

export function connectionStatus(state: CONNECTION_STATUS = CONNECTION_STATUS.WAITING, action: IAction) {
    switch (action.type) {
        case ACTION.SetConnectionStatus:
            return action.status;
        case ACTION.SetInitialState:
            return CONNECTION_STATUS.INITED;
        case ACTION.AuthStatus:
            if (action.pwd && action.otp) 
                return CONNECTION_STATUS.INITING;
            return CONNECTION_STATUS.LOGIN;
        case ACTION.Login:
            return CONNECTION_STATUS.AUTHENTICATING;
    }
    return state;
}

export function loaded(state = false, action: IAction) {
    if (action.type == ACTION.SetInitialState) return true;
    if (action.type == ACTION.Logout) return false;
    return state;
}

export function messageExpanded(state: {[id:number]: boolean}  = {}, action: IAction) {
    if (action.type == ACTION.SetMessageExpanded) {
        let ans = {...state};
        ans[action.id] = action.expanded;
        return ans;
    }
    return state;
}

export function messageGroupExpanded(state: {[id:number]: boolean}  = {}, action: IAction) {
    if (action.type == ACTION.SetMessageGroupExpanded) {
        let ans = {...state};
        ans[action.id] = action.expanded;
        return ans;
    }
    return state;
}

export function authStatus(state: IAuthStatus | null, action: IAction) {
    if (action.type == ACTION.AuthStatus) {
        return action;
    }
    return state;
}

export function login(state: ILogin = {user: "", pwd: "", otp: ""}, action: IAction) {
    switch (action.type) {
    case ACTION.SetLoginUsername: return {...state, user: action.value};
    case ACTION.SetLoginPassword: return {...state, pwd: action.value};
    case ACTION.SetLoginOtp: return {...state, otp: action.value};   
    case ACTION.Login: return {...state, otp: "", pwd: ""};
    case ACTION.Logout: 
        if (action.forgetOtp) return {user: "", pwd: "", otp: ""};
        break;
    case ACTION.AuthStatus: 
        if (action.user) return {...state, user: action.user};
        break;
    }
    return state;
}

export function mainReducer(state: IMainState = null, action: IAction) {
    let ns: IMainState = {
        status: status(state ? state.status : undefined, action),
        page: page(state ? state.page : undefined, action),
        objectListFilter: objectListFilter(state ? state.objectListFilter : undefined, action),
        objectDigests: objectDigests(state ? state.objectDigests : undefined, action),
        objects: objects(state ? state.objects : undefined, action),
        types: types(state ? state.types: undefined, action),
        serviceListFilter: serviceListFilter(state ? state.serviceListFilter : undefined, action),
        messages: messages(state ? state.messages : undefined, action),
        serviceLogVisibility: serviceLogVisibility(state ? state.serviceLogVisibility : undefined, action),
        deployment: deployment(state ? state.deployment : undefined, action),
        connectionStatus: connectionStatus(state ? state.connectionStatus: undefined, action),
        loaded: loaded(state ? state.loaded: undefined, action),
        messageExpanded: messageExpanded(state ? state.messageExpanded: undefined, action),
        messageGroupExpanded: messageGroupExpanded(state ? state.messageGroupExpanded: undefined, action),
        authStatus: authStatus(state ? state.authStatus: undefined, action),     
        login: login(state ? state.login: undefined, action),     
    };
    changeCurrentObject(ns);
    return ns;
}
