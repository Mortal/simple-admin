import * as React from "react";
import {InformationList, InformationListRow} from './information_list'
import TextField from 'material-ui/TextField';
import Toggle from 'material-ui/Toggle';
import {IObject, IHostContent} from '../../shared/state'
import {IMainState} from './reducers';
import {Dispatch} from 'redux'
import {connect} from 'react-redux'
import {ACTION, ISetObjectName, ISetObjectContentParam} from '../../shared/actions'

interface IProps {
    id: number;
}

interface StateProps {
    current: IObject
    id: number
}

interface DispactProps {
    setName: (name: string) => void;
    setProp: (prop:string, value:any) => void;
}

function mapStateToProps(s:IMainState, p: IProps): StateProps {
    return {current: s.objects[p.id].current, id: p.id};
}

function mapDispatchToProps(dispatch:Dispatch<IMainState>, p: IProps): DispactProps {
     return {
        setName: (name: string) => {
            const a:ISetObjectName = {
                type: ACTION.SetObjectName,
                id: p.id,
                name
            };
            dispatch(a);
        },
        setProp: (prop:string, value:any) => {
            const a:ISetObjectContentParam = {
                type: ACTION.SetObjectContentParam,
                id: p.id,
                param: prop,
                value
            };
            dispatch(a);
        },
    }
}

export function HostImpl(props: StateProps & DispactProps) {
    const c = props.current.content as IHostContent;
    return (
        <div>
            <InformationList key={props.id + props.current.version}>
                <InformationListRow name="Hostname"><TextField value={props.current.name} onChange={(e:any, value:string) => props.setName(value)} /></InformationListRow>
                <InformationListRow name="Password"><TextField type="password" value={c.password} onChange={(e:any, value:string) => props.setProp("password",value)}/></InformationListRow>
                <InformationListRow name="Message on down"><Toggle alt="Should we generate messages when the server goes down" toggled={c.messageOnDown !== false} onToggle={(e:any, value:boolean) => props.setProp("messageOnDown",value)}/></InformationListRow>
            </InformationList>
        </div>)
}

export const Host = connect(mapStateToProps, mapDispatchToProps)(HostImpl);