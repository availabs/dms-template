import React from "react"

import { format as d3format } from "d3-format"
import { range as d3range } from "d3-array"
import { useNavigate } from 'react-router'

import {
	getFileContent,
	PreviewColumns,
	// DataColumns
} from "./utils";

import { createPageTheme } from "./createPage.theme"

const MIN_SOURCE_NAME_LENGTH = 4;
const intFormat = d3format(",d");

const Create = ({ context, source }) => {

	const theContextStuff = React.useContext(context) || {};

  const {
  	user,
  	useFalcor,
  	datasources,
  	API_HOST,
  	UI,
  	dmsEnvs,
  	baseUrl,
  	theme,
  	...rest
  } = theContextStuff;
  const pgEnv = (datasources || []).find(d => d.type === 'external')?.env || '';
  const { falcor, falcorCache } = useFalcor();

	const t = {
		...(createPageTheme || {}),
		...(theme?.datasets?.fileUploadCreate || {})
	};

  const { Button } = UI;

	const [loading, setLoading] = React.useState(0);
	const startLoading = React.useCallback(e => {
		setLoading(l => l + 1);
	}, []);
	const stopLoading = React.useCallback(e => {
		setLoading(l => l - 1);
	}, []);

  const [error, setError] = React.useState("");

  const [inputRef, setInputRef] = React.useState(null);
  const clickInputRef = React.useCallback(() => {
  	if (!inputRef) return;
  	inputRef.click();
  }, [inputRef]);
  const [tmasFile, setTmasFile] = React.useState(null);
  const doSetTmasFile = React.useCallback(e => {
  	setTmasFile(e.target.files[0]);
  }, []);

  const [fileContent, setFileContent] = React.useState([]);
  React.useEffect(() => {
  	if (!tmasFile) return;
  	tmasFile.text()
  		.then(getFileContent)
  		.then(setFileContent);
  }, [tmasFile]);

  const okToSend = React.useMemo(() => {
  	return (tmasFile !== null) & (source.name.length >= MIN_SOURCE_NAME_LENGTH);
  }, [tmasFile, source.name]);

  const navigate = useNavigate();
  const sendRequest = React.useCallback(e => {
  	if (!okToSend) return;

  	startLoading();

    const formData = new FormData();

    formData.append("source_name", source.name);
    if (source?.source_id) {
    	formData.append("source_id", source.source_id);
    }
    if (user?.id) {
    	formData.append("user_id", user.id);
    }
    formData.append("file", tmasFile);

		const url = `${ API_HOST }/dama-admin/${ pgEnv }/TMAS_station_uploader/publish`;
		// console.log("Create::sendRequest::url", url);

  	fetch(url, { method: 'POST', body: formData })
  		.then(res => res.json())
	  	.then(res => {
	  		if (res.ok) {
	  			navigate(`${ baseUrl }/task/${ res.etl_context_id }`);
	  		}
	  		else {
	  			throw new Error(res.error);
	  		}
	  	}).catch(e => {
	  		setError(e.message || e);
	  	});
  }, [okToSend, API_HOST, pgEnv, tmasFile, source, user,
  		baseUrl, startLoading, stopLoading]);

	return (
		<div>
  		<input ref={ setInputRef } type="file" className="hidden"
  			onChange={ doSetTmasFile }/>
  		<div className="flex">
  			<div className="flex-1">
		  		<Button onClick={ clickInputRef }>
		  			Select File
		  		</Button>
		  	</div>
	  		{ source.name.length >= MIN_SOURCE_NAME_LENGTH ? null :
	  			<div className="bg-red-100 rounded text-red-600 px-3 flex items-center">
	  				{ "You must enter a Dataset name of length 4 or more" }
	  			</div>
	  		}
	  	</div>

  		{ !tmasFile ? null :
  				<>
						<div className="my-1"/>
	  				<Preview key={ tmasFile?.name }
	  					fileName={ tmasFile?.name }
	  					fileSize={ tmasFile?.size }
	  					fileContent={ fileContent } theme={ t }/>
						<div className={ t.divider }/>
						<div className="my-1"/>
	  			</>
  		}
  		{ !okToSend ? null :
  			<div className="flex justify-end items-center">
  				<div className="font-bold pr-2">
  					{ error ? "" : "If everything looks ok..." }
  				</div>
					<Button onClick={ sendRequest }>
						Upload File
					</Button>
				</div>
			}

		</div>
	)
}
export default Create;

const PreviewRowIndices = PreviewColumns.reduce((a, c, i) => {
	a[c] = i;
	return a;
}, {})
const previewRowSorter = (a, b) => {
	const aIndex = PreviewRowIndices[a.name];
	const bIndex = PreviewRowIndices[b.name];
	return aIndex - bIndex;
}

const NumToShow = 3;
const ScrollAmount = 3;

const RowColors = [
	"bg-red-300",
	"bg-green-300",
	"bg-blue-300",
	"bg-gray-300"
]

const FilterComparators = {
	"Equal To": (a, b) => a === b,
	"Not Equal To": (a, b) => a !== b
}

const Preview = ({ fileContent, theme, fileName, fileSize }) => {

	const [filters, setFilters] = React.useState([]);
	const addFilter = React.useCallback((k, v, compare = "Equal To") => {
		setFilters(prev => {
			const filtered = prev.filter(f => (f.key !== k) || (f.value !== v) || (f.compare !== compare));
			return [...filtered, { key: k, value: v, compare }];
		});

	}, []);
	const removeFilter = React.useCallback(i => {
		setFilters(prev => prev.filter((f, ii) => i !== ii));
	}, []);

	const filteredFileContent = React.useMemo(() => {
		if (!filters.length) return fileContent;
		return fileContent.reduce((a, c) => {
			const filteredRow = c.filter(di => PreviewColumns.includes(di.name));
			const isOk = filters.reduce((aa, cc) => {
				const index = PreviewRowIndices[cc.key];
				const compare = FilterComparators[cc.compare];
				return aa && compare(filteredRow[index].value, cc.value);
			}, true);
			if (isOk) {
				a.push(c);
			}
			return a;
		}, []);
	}, [fileContent, filters]);

	const [slices, setSlices] = React.useState([0, NumToShow]);

	const onMouseWheel = React.useCallback(e => {
		if (e.deltaY > 0) {
			// scrolled DOWN
			setSlices(([x, y]) => {
				const newX = Math.min(filteredFileContent.length - NumToShow, x + ScrollAmount);
				return [newX, newX + NumToShow]
			})
		}
		else if (e.deltaY < 0) {
			// scrolled UP
			setSlices(([x, y]) => {
				const newX = Math.max(0, x - ScrollAmount);
				return [newX, newX + NumToShow]
			})
		}
	}, [filteredFileContent.length]);

	const handleRangeInput = React.useCallback(e => {
		setSlices(() => {
			return [+e.target.value, +e.target.value + NumToShow];
		})
	}, [filteredFileContent.length]);

	const actualSlices = React.useMemo(() => {
		const maxSlice = Math.min(filteredFileContent.length, slices[1]);
		const minSlice = Math.max(0, maxSlice - NumToShow);
		return [minSlice, maxSlice];
	}, [slices, filteredFileContent.length]);

	return (
		<div className="relative">

			<div className={ `${ theme.fileInfoTitle } items-end`}>
				<div className="flex-1 flex items-end">
					File Preview
					<div className="ml-2 flex items-center">
						(
						<span className="text-xs font-normal mt-[2px]">
							{ fileName }, <span className="text-xs">{ intFormat(fileSize) } bytes</span>
						</span>
						)
					</div>
				</div>
				<div className="font-normal text-xs">
					Viewing rows { intFormat(actualSlices[0] + 1) } to { intFormat(actualSlices[1]) } of { intFormat(filteredFileContent.length) }
				</div>
			</div>

			<div className="pb-2 border-b-2 mb-2 grid grid-cols-10 gap-1 text-center text-xs mt-1 mr-4">
				{ PreviewColumns.map((col, i) => (
						<div key={ col }
							className={ `
								font-bold overflow-hidden overflow-ellipsis
								${ RowColors[Math.floor(i / 10)] }
							` }
						>
							{ col.replaceAll("_", " ") }
						</div>
					))
				}
			</div>

			<div className="flex relative">

				{ !filters.length ? null :
					<div
						className={ `
							absolute top-0 w-100 bg-white p-1 whitespace-nowrap
							text-xs mr-6 rounded
						` }
						style={ {
							right: "100%"
						} }
					>
						<div className="text-sm border-b-2 font-bold">
							Current Table Filters
						</div>
						{ filters.map((f, i) => (
								<FilterItem key={ i }
									filter={ f }
									index={ i }
									remove={ removeFilter }/>
							))
						}
					</div>
				}

				<div className="flex-1">
					<div onWheel={ onMouseWheel }>
						{ filteredFileContent.slice(...actualSlices)
								.map((row, i) => (
									<div key={ i }
										className="pb-2 border-b-2 mb-2"
									>
										<div
											className={ `
												grid grid-cols-10 gap-1 font-bold text-center text-xs
											` }
										>
											{ row.filter(di => PreviewColumns.includes(di.name))
													.sort(previewRowSorter)
													.map((di, i) => (
														<PreviewDataItem key={ di.name }
															Key={ di.name }
															Value={ di.value }
															bgColor={ RowColors[Math.floor(i / 10)] }
															onClick={ addFilter }/>
													))
											}
										</div>
									</div>
								))
						}
					</div>
				</div>
				<div className="w-4 bg-gray-300 flex justify-center">
					<input type="range"
						className="cursor-pointer"
						min={ 0 }
						max={ filteredFileContent.length - NumToShow }
						value={ slices[0] }
						onChange={ handleRangeInput }
						style={ {
							writingMode: "vertical-lr",
							direction: "ltr"
						} }/>
				</div>
			</div>

			<div className="flex bg-gray-300 px-1 mb-1 text-xs">
				<div className="flex-1">
					click a column to filter all rows with a column value EQUAL TO value clicked
				</div>
				<div>
					scroll your mouse wheel or drag the slider to view records <span className="fas fa-caret-up"/>
				</div>
			</div>

			<div className="flex bg-gray-300 px-1 mb-1 text-xs">
				<div className="flex-1">
					right click a column to filter all rows with a column value NOT EQUAL TO value clicked
				</div>
			</div>

		</div>
	)
}

const FilterItem = ({ filter, remove, index }) => {
	const doRemove = React.useCallback(e => {
		remove(index);
	}, [remove, index]);

	return (
		<div className="grid grid-cols-5 gap-1">
			<div className="col-span-3 whitespace-nowrap flex">
				<span onClick={ doRemove }
					className={ `
						fas fa-remove px-2 py-1 hover:bg-gray-300
						cursor-pointer rounded-sm
					` }
				/>
				<div className="overflow-hidden overflow-ellipsis flex-1 text-right">
					{ filter.key }
				</div>
			</div>
			<div className="overflow-hidden overflow-ellipsis whitespace-nowrap text-center">
				{ filter.compare }
			</div>
			<div className="overflow-hidden overflow-ellipsis whitespace-nowrap text-center">
				{ filter.value || "null" }
			</div>
		</div>
	)
}

const PreviewDataItem = ({ Key, Value, onClick, bgColor }) => {
	const doOnClick = React.useCallback(e => {
		e.preventDefault();
		if (e.type === "contextmenu") {
			onClick(Key, Value, "Not Equal To");
		}
		else {
			onClick(Key, Value);
		}
	}, [onClick, Key, Value]);
	return (
		<div
			onClick={ doOnClick }
			onContextMenu={ doOnClick }
			className={ `
				overflow-hidden overflow-ellipsis cursor-pointer font-medium
				hover:outline-2 whitespace-nowrap ${ bgColor }
			` }
		>
			{ Value }
		</div>
	)
}