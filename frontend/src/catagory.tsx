import * as React from "react";
import AutoComplete from 'material-ui/AutoComplete';
import {IMainState} from './reducers';
import {connect} from 'react-redux'

interface IProps {
    catagory: string;
    cls: string;
    setCatagory(catagory:string): void;
}

interface StateProps {
    p: IProps;
    catagories: string[];
}

function mapStateToProps(s:IMainState, p: IProps): StateProps {
    return {p, catagories: s.objectNamesAndIds[p.cls].map(x=>x.catagory)}
}

function CatagoryImpl(props: StateProps) {
    console.log(props.catagories);
    return <AutoComplete
                searchText={props.p.catagory || ""}
                filter={AutoComplete.caseInsensitiveFilter}
                onUpdateInput={props.p.setCatagory}
                hintText="Catagory"
                dataSource={props.catagories}
                />;
}

export const Catagory = connect(mapStateToProps)(CatagoryImpl);
