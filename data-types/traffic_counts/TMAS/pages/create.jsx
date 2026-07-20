import React from "react"

// import { ThemeContext } from "../../../../../ui/useTheme";

import { format as d3format } from "d3-format"

import { createPageTheme } from "./createPage.theme"

import { checkTmasFile } from "./utils"

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
  	...rest
  } = theContextStuff;
  const pgEnv = (datasources || []).find(d => d.type === 'external')?.env || '';
  const { falcor, falcorCache } = useFalcor();

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
    formData.append("file", tmasFile);

		const url = `${ API_HOST }/dama-admin/${ pgEnv }/TMAS_uploader/publish`;
		// console.log("Create::sendRequest::url", url);
		
  	fetch(url, { method: 'POST', body: formData })
  		.then(res => res.json())
	  	.then(res => console.log("REQUEST RES:", res))
  }, [API_HOST, pgEnv, tmasFile, source, user]);

  const { Button } = UI;

  return (
  	<div>
  		<input ref={ setInputRef } type="file" className="hidden"
  			onChange={ doSetTmasFile }/>
  		<Button onClick={ clickInputRef }>
  			Select File
  		</Button>
  		{ !tmasFile ? null :
	  			<File file={ tmasFile }
	  				theContextStuff={ theContextStuff }/>
  		}
  		{ !okToSend ? null :
  			<div className="flex justify-end">
					<Button onClick={ sendRequest }>
						Upload File
					</Button>
				</div>
			}
  	</div>
  	)
}
export default Create;

const yearRegex = /.*(\d{4}).*/;

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

	const { Button } = UI;

	const [directory, setDirectory] = React.useState("");
	const doSetDirectory = React.useCallback(e => {
		setDirectory(e.target.value);
	}, []);

  const [description, setDescription] = React.useState("");
  const doSetDescription = React.useCallback(e => {
  	setDescription(e.target.value);
  }, []);

  const [uploading, setUploading] = React.useState(false);

  // const navigate = useNavigate();

  const [error, setError] = React.useState(null);
  const clearError = React.useCallback(e => {
  	setError(null);
  }, []);

//   const uploadFile = React.useCallback(e => {

//   	if (!owner?.id || !ownerInstance) {
//   		setError("No dmsEnv or parent pattern available to own the source.");
//   		return;
//   	}

//   	setUploading(true);

//     const formData = new FormData();

//     formData.append("owner_id", owner.id);
//     formData.append("owner_instance", ownerInstance);
//     formData.append("owner_ref", `${app}+${ownerInstance}|source`);

//     formData.append("file_name", file.name);
//     formData.append("file_type", file.type || "application/octet-stream");
//     formData.append("directory", directory);
//     formData.append("description", description);

//     formData.append("categories", JSON.stringify([["Uploaded File"]]));

//     if (sourceId) {
//     	// Server derives source_slug from the existing source row's type.
//     	formData.append("source_id", sourceId);
//     } else {
//     	formData.append("source_name", sourceName);
//     }
//     if (user?.id) {
//     	formData.append("user_id", user.id);
//     }
//     formData.append("file", file);

//     fetch(
//       `${ API_HOST }/dms-admin/${ app }/file_upload`,
//       { method: "POST", body: formData }
//     ).then(res => res.json())
//       .then(json => {

// console.log("uploadFile::response", json);

//         if (json.ok) {
//         	// Invalidate the owner row so its updated sources list is refetched,
//         	// and the new source/view rows so the detail page renders the file.
//         	Promise.all([
//         		falcor.invalidate(["dms", "data", app, "byId", owner.id]),
//         		falcor.invalidate(["dms", "data", app, "byId", json.source_id]),
//         		falcor.invalidate(["dms", "data", app, "byId", json.view_id]),
//         	]).finally(() => {
//         		clearDatasetsListCache();
//         		navigate(`${ baseUrl }/source/${ json.source_id }`);
//         	});
//         }
//         else {
//         	setError(json.error);
//         }
//       })
//       .catch(err => setError(err.message))
//       .finally(e => setUploading(false));

//   }, [API_HOST, app, owner, ownerInstance, baseUrl, file, sourceName,
//   		description, user, navigate, sourceId, directory, falcor
//   	]);

	return (
		<>
			{ !uploading ? null :
				<div className={t.uploadingOverlay}>
					UPLOADING FILE...
				</div>
			}
			{ !error ? null :
				<div className={t.errorOverlay}>
					<div>There was an error uploading your file:</div>
					<div>{ error }</div>
					<button onClick={ clearError }
						className={t.errorCloseBtn}
					>
						Close
					</button>
				</div>
			}
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
		</>
	)
}
