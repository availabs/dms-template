import React from "react"

// import { ThemeContext } from "../../../../../ui/useTheme";

import { format as d3format } from "d3-format"
import { range as d3range } from "d3-array"

import { createPageTheme } from "./createPage.theme"

import {
	checkTmasFile,
	PreviewColumns,
	DataColumns
} from "./utils";

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

// console.log("theContextStuff", theContextStuff);
// console.log("UI", UI);

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
  const [usePre2020Format, setUsePre2020Format] = React.useState(false);
  React.useEffect(() => {
  	if (!tmasFile) return;
  	tmasFile.text()
  		.then(checkTmasFile)
  		.then(({ rows, usePre2020 }) => {
  			setFileContent(rows);
  			setUsePre2020Format(usePre2020);
  		});
  }, [tmasFile]);

  const okToSend = React.useMemo(() => {
  	return (tmasFile !== null) & (source.name.length >= MIN_SOURCE_NAME_LENGTH);
  }, [tmasFile, source.name]);

  const sendRequest = React.useCallback(e => {

    const formData = new FormData();

    formData.append("source_name", source.name);
    if (source?.source_id) {
    	formData.append("source_id", source.source_id);
    }
    if (user?.id) {
    	formData.append("user_id", user.id);
    }
    formData.append("format", usePre2020Format ? "pre-2020-format" : "post-2020-format")
    formData.append("file", tmasFile);

		const url = `${ API_HOST }/dama-admin/${ pgEnv }/TMAS_uploader/publish`;
		// console.log("Create::sendRequest::url", url);

  	fetch(url, { method: 'POST', body: formData })
  		.then(res => res.json())
	  	.then(res => console.log("REQUEST RES:", res))
  }, [API_HOST, pgEnv, tmasFile, source, user, usePre2020Format]);

  const { Button } = UI;

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
	  		{ source.name.length >= 4 ? null :
	  			<div className="bg-red-100 rounded text-red-600 px-3 flex items-center">
	  				{ "You must enter a Dataset name of length 4 or more" }
	  			</div>
	  		}
	  	</div>
  		{ /*
  			!tmasFile ? null :
	  			<File file={ tmasFile }
	  				theContextStuff={ theContextStuff }/>
	  		*/
  		}
  		{ !tmasFile ? null :
  				<>
						<div className="my-1"/>
	  				<Preview key={ tmasFile?.name }
	  					fileName={ tmasFile?.name }
	  					fileSize={ tmasFile?.size }
	  					fileContent={ fileContent } theme={ t }/>
						<div className={t.divider}/>
						<div className="my-1"/>
	  			</>
  		}
  		{ !okToSend ? null :
  			<div className="flex justify-end items-center">
  				<div className="font-bold pr-2">
  					If everything looks ok...
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

const File = ({ file, sourceId, sourceName, theContextStuff }) => {

	const {
		app,
		baseUrl,
		useFalcor,
		user,
		dmsEnv,
		parent,
		API_HOST,
		theme,
		UI
	} = theContextStuff;

	const t = {
		...(createPageTheme || {}),
		...(theme?.datasets?.fileUploadCreate || {})
	};

	return (
		<div>
			<div className={t.fileInfoTitle}>
				File Info
			</div>

			<div className={t.fileInfoGrid}>
				<div className={t.fileInfoLabel}>file name:</div>
				<div className={t.fileInfoValue}>{ file.name }</div>
			</div>
			<div className={t.fileInfoGrid}>
				<div className={t.fileInfoLabel}>file size:</div>
				<div className={t.fileInfoValue}>{ intFormat(file.size) } bytes</div>
			</div>
			<div className={t.fileInfoGrid}>
				<div className={t.fileInfoLabel}>file type:</div>
				<div className={t.fileInfoValue}>
					{ file.type || "application/octet-stream" }
				</div>
			</div>
			<div className={t.fileInfoGrid}>
				<div className={t.fileInfoLabel}>last modified:</div>
				<div className={t.fileInfoValue}>
					{ (new Date(file.lastModified)).toLocaleString() }
				</div>
			</div>

		</div>
	)
}

const PreviewRowIndices = PreviewColumns.reduce((a, c, i) => {
	a[c] = i;
	return a;
}, {})
const previewRowSorter = (a, b) => {
	const aIndex = PreviewRowIndices[a.name];
	const bIndex = PreviewRowIndices[b.name];
	return aIndex - bIndex;
}

const NumToShow = 11;
const ScrollAmount = Math.round(NumToShow * 0.75);

const Preview = ({ fileContent, theme, fileName, fileSize }) => {

	const [showData, setShowData] = React.useState([]);
	const toggleShowData = React.useCallback(index => {
		setShowData(prev => {
			if (prev.includes(index)) {
				return prev.filter(i => i != index)
			}
			return [...prev, index];
		})
	}, []);

	const [slices, setSlices] = React.useState([0, NumToShow]);

	const onMouseWheel = React.useCallback(e => {
		if (e.deltaY > 0) {
			// scrolled DOWN
			setSlices(([x, y]) => {
				const newX = Math.min(fileContent.length - NumToShow, x + ScrollAmount);
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
	}, [fileContent.length]);

	React.useEffect(() => {
		const indices = d3range(...slices);
		setShowData(showingIndices => {
			return showingIndices.filter(i => indices.includes(i));
		})
	}, [slices]);

	return (
		<div>
			<div className={ `${ theme.fileInfoTitle } items-end`}>
				<div className="flex-1 flex items-end">
					File Preview
					<div className="ml-2 flex items-center">
						(
						<span className="text-xs font-normal mt-1">
							{ fileName }, <span className="text-xs">{ intFormat(fileSize) } bytes</span>
						</span>
						)
					</div>
				</div>
				<div className="font-normal text-xs">
					Viewing rows { intFormat(slices[0] + 1) } to { intFormat(slices[1]) } of { intFormat(fileContent.length) }
				</div>
			</div>
			<div className="grid grid-cols-9 gap-1 text-center text-xs mt-1">
				{ PreviewColumns.map(col => (
						<div key={ col }
							className="bg-gray-300 font-bold overflow-hidden overflow-ellipsis"
						>
							{ col }
						</div>
					))
				}
			</div>

			<div onWheel={ onMouseWheel }>
				{ fileContent.slice(...slices)
						.map((rows, i) => (
							<div key={ i }
								onClick={ () => toggleShowData(i + slices[0]) }
								className="border-b cursor-pointer hover:bg-blue-300 even:bg-gray-300"
							>
								<div
									className={ `
										grid grid-cols-9 gap-1 font-bold text-center text-xs
										${ showData.includes(i + slices[0]) ? "bg-blue-300" : "" }
									` }
								>
									{ rows.filter(r => PreviewColumns.includes(r.name))
											.sort(previewRowSorter)
											.map(r => (
												<div key={ r.name }>
													{ r.value }
												</div>
											))
									}
								</div>
								{ showData.includes(i + slices[0]) ?
									<div
										className={ `
											grid grid-cols-12 gap-1
											${ showData.includes(i + slices[0]) ? "bg-blue-200" : "" }
										` }
										style={ {
											fontSize: "0.625rem",
											lineHeight: "0.75rem"
										} }
									>
										{ rows.filter(r => DataColumns.includes(r.name))
												.map((r, ii) => (
													<div key={ r.name } className="pl-1 flex">
														<div className="w-7">
															hr{ ii }:
														</div>
														<div>
															{ +r.value }
														</div>
													</div>
												))
										}
									</div> : null
								}
							</div>
						))
				}
			</div>
			<div className="flex bg-gray-300 px-1">
				<div className="flex-1 text-xs">
					scroll your mouse wheel to view records
				</div>
				<div className="text-xs">
					click a row to view its hourly data
				</div>
			</div>

		</div>
	)
}
