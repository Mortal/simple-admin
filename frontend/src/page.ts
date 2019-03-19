import * as React from "react";
import * as State from '../../shared/state'
import * as Actions from '../../shared/actions'
import {Dispatch} from 'redux'
import {IMainState} from './reducers';
import * as $ from 'jquery'
import { action, observable } from "mobx";
import state, { ObjectState } from "./state";



function never(n:never, message:string) {
    console.error(message);
}


export class PageState {
    @observable
    nextNewObjectId:number = -2;

    @observable
    current: State.IPage = { type: State.PAGE_TYPE.Dashbord };

    onClick(e: React.MouseEvent<{}>, page: State.IPage) {
        if (e.metaKey || e.ctrlKey || e.button === 2) return;
        e.preventDefault();
        this.set(page);
    }

    @action
    set(page: State.IPage) {
        let pg = Object.assign({}, page);
        if (pg.type == State.PAGE_TYPE.Object && pg.id === null) {
            pg.id = this.nextNewObjectId;
            --this.nextNewObjectId;
        }
        history.pushState(page, null, this.link(pg));

        this.current = page;

        if (page.type == State.PAGE_TYPE.Object) {
            if (!state.objects.has(page.id))
                state.objects.set(page.id, new ObjectState(page.id));
            state.objects.get(page.id).loadCurrent();
        }
    }

    link(page: State.IPage): string {
        var o: {[string:string]:string} = {}
        switch(page.type) {
        case State.PAGE_TYPE.Deployment:
            o['page'] = 'deployment';
            break;
        case State.PAGE_TYPE.Dashbord:
            o['page'] = 'dashbord';
            break;
        case State.PAGE_TYPE.ObjectList:
            o['page'] = 'objectlist';
            o['type'] = ""+page.objectType;
            break;
        case State.PAGE_TYPE.Object:
            o['page'] = 'object';
            o['type'] = ""+page.objectType;
            if (page.id !== null) o['id'] = ""+page.id;
            else o['id'] == '-1';
            if (page.version !== null) o['version'] = ""+page.version;
            break;
        case State.PAGE_TYPE.DeploymentDetails:
            o['page'] = 'deploymentDetails'
            o['index'] = ""+page.index;
            break;
        default:
            never(page, "Unhandled page");
        }
        return "?"+$.param(o)
    }
    
    @action
    setFromUrl() {
        const getUrlParameter = (name:string) => {
            name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
            var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
            var results = regex.exec(location.search);
            return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
        };

        let p = getUrlParameter('page');
        switch (p) {
        default:
            this.current = {type: State.PAGE_TYPE.Dashbord};
            break;
        case 'deployment':
            this.current = {type: State.PAGE_TYPE.Deployment};
            break;
        case 'objectlist':
            this.current = {type: State.PAGE_TYPE.ObjectList, objectType: +getUrlParameter('type')};
            break;
        case 'object':
            let v=getUrlParameter('version');
            this.current = {type: State.PAGE_TYPE.Object, objectType: +getUrlParameter('type'), id: +getUrlParameter('id'), version: (v?+v:null)};
            if (!state.objects.has(this.current.id))
                state.objects.set(this.current.id, new ObjectState(this.current.id));
            state.objects.get(this.current.id).loadCurrent();
            break;
        case 'deploymentDetails':
            this.current = {type: State.PAGE_TYPE.DeploymentDetails, index: +getUrlParameter('index')};
            break;
        }
    }
    
};








