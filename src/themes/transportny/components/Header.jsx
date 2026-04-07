import React, { useContext, useEffect } from "react";
import { ComponentContext } from "../../../dms/packages/dms/src/patterns/page/context";

const isJson = (str) => {
    try {
        JSON.parse(str);
    } catch {
        return false;
    }
    return true;
};

const Edit = ({ value, onChange }) => {
    const { state, setState } = useContext(ComponentContext);

    const cachedData =
        value && isJson(value) ? JSON.parse(value) : {};

    useEffect(() => {
        if (cachedData) {
            setState((draft) => {
                if (!draft.display) draft.display = {};
                draft.display.header = cachedData.header || "Header";
                draft.display.sub_header = cachedData.sub_header || "Sub-Header";
                draft.display.description =
                    cachedData.description || "Description";
            });
        }
    }, []);

    const display = state?.display || {};

    const updateField = (key, val) => {
        setState((draft) => {
            if (!draft.display) draft.display = {};
            draft.display[key] = val;
        });

        const updated = {
            header: key === "header" ? val : display.header,
            sub_header: key === "sub_header" ? val : display.sub_header,
            description: key === "description" ? val : display.description,
        };

        onChange(JSON.stringify(updated));
    };

    return (
        <div className="relative bg-[url('/themes/transportny/transportNY_header_background.png')] bg-center bg-cover min-h-[340px] flex items-end justify-center">
            <div className="absolute bottom-0 left-0 w-full h-[75%] bg-gradient-to-t from-white/80 to-transparent pointer-events-none"></div>
            <div className="py-10 ml-[40px] w-2/3 relative">
                <div className="max-w-2xl">

                    <input
                        className="text-[40px] font-semibold text-gray-900 tracking-tight leading-[1.2] bg-transparent outline-none w-full"
                        value={display.header || "Header"}
                        onChange={(e) => updateField("header", e.target.value)}
                    />

                    <input
                        className="text-[24px] mt-2 font-medium text-gray-900 bg-transparent outline-none w-full"
                        value={display.sub_header || "Sub-Header"}
                        onChange={(e) => updateField("sub_header", e.target.value)}
                    />

                    <textarea
                        className="mt-4 text-[15px] font-normal text-gray-600 leading-relaxed bg-transparent outline-none w-full resize-none"
                        rows={3}
                        value={display.description || "Description"}
                        onChange={(e) => updateField("description", e.target.value)}
                    />

                </div>
            </div>
        </div>
    );
};

const View = ({ value }) => {
    const cachedData =
        value && isJson(value) ? JSON.parse(value) : {};

    return (
        <div className="relative bg-[url('/themes/transportny/transportNY_header_background.png')] bg-center bg-cover min-h-[340px] flex items-end justify-center">
            <div className="absolute bottom-0 left-0 w-full h-[75%] bg-gradient-to-t from-white/80 to-transparent pointer-events-none"></div>
            <div className="py-10 ml-[40px] w-2/3 relative">
                <div className="max-w-2xl">

                    <h1 className="text-[40px] font-semibold text-gray-900 tracking-tight leading-[1.2]">
                        {cachedData.header || "Header"}
                    </h1>

                    <h2 className="text-[24px] mt-2 font-medium text-gray-900">
                        {cachedData.sub_header || "Sub-Header"}
                    </h2>

                    <p className="mt-4 text-[15px] font-normal text-gray-600 leading-relaxed">
                        {cachedData.description || "Description"}
                    </p>

                </div>
            </div>
        </div>
    );
};

export default {
    name: "TransportNY header",
    EditComp: Edit,
    ViewComp: View,
    defaultState: {
        display: {
            header: "Header",
            sub_header: "Sub-Header",
            description: "Description",
        },
    },
    controls: {
        default: [
            { type: "input", inputType: "text", label: "Header", key: "header" },
            { type: "input", inputType: "text", label: "Sub-Header", key: "sub_header" },
            { type: "input", inputType: "textarea", label: "Description", key: "description" },
        ],
    },
};
