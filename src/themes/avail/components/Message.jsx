import React, {useContext, useEffect, useState} from "react";
import {isEqual} from "lodash-es";
import {ComponentContext} from "../../../dms/packages/dms/src/patterns/page/context";

const isJson = (str) => {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

const Edit = ({value, onChange}) => {
    const {state, setState} = useContext(ComponentContext);
    const cachedData = value && isJson(value) ? JSON.parse(value) : {};
    const message = state?.display?.message ?? cachedData?.message ?? 'Hello, World!';

    useEffect(() => {
        const newData = {message: state?.display?.message ?? 'Hello, World!'};
        const currentData = value && isJson(value) ? JSON.parse(value) : {};

        if (!isEqual(newData, {message: currentData.message})) {
            onChange(JSON.stringify(newData));
        }
    }, [state?.display?.message]);

    // Initialize state.display from saved data on mount
    useEffect(() => {
        if (cachedData?.message !== undefined) {
            setState(draft => {
                if (!draft.display) draft.display = {};
                draft.display.message = cachedData.message;
            });
        }
    }, []);

    return (
        <div className="p-4 rounded-lg border border-blue-200 bg-blue-50">
            <p className="text-lg">{message}</p>
        </div>
    );
}

const View = ({value}) => {
    const cachedData = value && isJson(value) ? JSON.parse(value) : {};
    const message = cachedData?.message ?? 'Hello, World!';

    return (
        <div className="p-4 rounded-lg border border-blue-200 bg-blue-50">
            <p className="text-lg">{message}</p>
        </div>
    );
}

export default {
    name: 'Message',
    EditComp: Edit,
    ViewComp: View,
    defaultState: {
        display: {message: 'Hello, World!'}
    },
    controls: {
        default: [
            {type: 'input', inputType: 'text', label: 'Message', key: 'message'}
        ]
    }
}
