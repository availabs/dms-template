import React from "react"

import {
	useGetActions,
	useFetchSources
} from "./utils"

import {
	SourceAndViewSelectors,
	LoadingIndicator
} from "./components"

const Create = ({ context, source }) => {

	const theContextStuff = React.useContext(context) || {};

  const { user, useFalcor, datasources, API_HOST, UI, dmsEnvs, baseUrl, ...rest } = theContextStuff;
  const { Select, Button } = UI;
  const pgEnv = (datasources || []).find(d => d.type === 'external')?.env || '';
  const { falcor, falcorCache } = useFalcor();

  const dmsEnvsList = React.useMemo(() => {
  	return [
  		...new Set(dmsEnvs.map(e => e.ref))
  	]
  }, [dmsEnvs]);

	const [loading, setLoading] = React.useState(0);
	const startLoading = React.useCallback((n = 1) => {
		setLoading(loading => loading + n);
	}, []);
	const stopLoading = React.useCallback((n = -1) => {
		setLoading(loading => loading + n);
	}, []);

  const { actionsSource, actionsView } = useGetActions({ falcor, falcorCache, dmsEnvs: dmsEnvsList, startLoading, stopLoading });

	useFetchSources({ falcor, falcorCache, pgEnv, startLoading, stopLoading });

	const [jurisdictionsSource, setJurisdictionsSource] = React.useState(null);
	const [jurisdictionsView, setJurisdictionsView] = React.useState(null);

	const [countiesSource, setCountiesSource] = React.useState(null);
	const [countiesView, setCountiesView] = React.useState(null);

	const requestArgs = React.useMemo(() => {
		const args = {
			sourceName: source.name,

			actionsSource: actionsSource?.source_id,
			actionsView: actionsView?.view_id,

			jurisdictionsSource,
			jurisdictionsView,

			countiesSource,
			countiesView
		}
		if (source.source_id) {
			args[source_id] = source.source_id
		}
		return args;
	}, [source, actionsSource, actionsView,
			jurisdictionsSource, jurisdictionsView,
			countiesSource, countiesView
		]
	);

// console.log("requestArgs", requestArgs);

	const okToSend = React.useMemo(() => {
		if (!API_HOST) return false;
		const {
			sourceName, ...rest
		} = requestArgs;
		return (sourceName.length >= 4) &&
						Object.values(rest).reduce((a, c) => a && Boolean(c), true);
	}, [requestArgs]
	);

	const sendRequest = React.useCallback(() => {
		if (!okToSend) return;
		const url = `${ API_HOST }/dama-admin/${ pgEnv }/actions_location/publish`;
		console.log("Create::sendRequest::url", url);
  	fetch(url, {
	    method: 'POST',
	    body: JSON.stringify(requestArgs),
	    headers: { 'Content-Type': 'application/json' },
	  }).then(res => res.json())
	  	.then(res => console.log("REQUEST RES:", res))
	}, [okToSend, API_HOST, pgEnv, requestArgs]);

	return (
		<div className="grid grid-cols-1 gap-4 relative">
				
			<LoadingIndicator loading={ Boolean(loading) }/>

			<div>
				<div className="font-bold">
					Actions Source and View
				</div>
				<div className="rounded-lg border border-zinc-950/10 py-1 px-2 mb-1 flex">
					<div className="flex-1">
						{ `${ actionsSource?.name }` }
					</div>
					{ `(internal source ID: ${ actionsSource?.source_id })` }
				</div>
				<div className="rounded-lg border border-zinc-950/10 py-1 px-2 flex">
					<div className="flex-1">
						{ `${ actionsView?.name }` }
					</div>
					{ `(view ID: ${ actionsView?.view_id })` }
				</div>
				<div className="text-sm">
					<a href={ `${ baseUrl }/internal_source/${ actionsSource?.source_id }`}
						className="text-blue-400 hover:text-blue-600"
						target="_blank"
					>
						view source <i className="fa-light fa-sm fa-arrow-up-right-from-square"/>
					</a>
				</div>
			</div>
			
			<SourceAndViewSelectors
				label="Select a Source and View for Jurisdiction Geometries"
				Select={ Select }
				falcor={ falcor }
				falcorCache={ falcorCache }
				pgEnv={ pgEnv }
				categories={ ["jurisdictions"] }
				columns={ ["wkb_geometry", "census_geo"] }
				source_id={ jurisdictionsSource }
				setSource={ setJurisdictionsSource }
				sourcePlaceholder="select a jurisdictions geometry source..."
				view_id={ jurisdictionsView }
				setView={ setJurisdictionsView }
				viewPlaceholder="select a jurisdictions geometry view..."
				baseUrl={ baseUrl }/>

			<SourceAndViewSelectors
				label="Select a Source and View for County Geometries"
				Select={ Select }
				falcor={ falcor }
				falcorCache={ falcorCache }
				pgEnv={ pgEnv }
				categories={ { or: ["Geography", "tiger"] } }
				columns={ ["wkb_geometry", "geoid"] }
				source_id={ countiesSource }
				setSource={ setCountiesSource }
				sourcePlaceholder="select a counties geometry source..."
				view_id={ countiesView }
				setView={ setCountiesView }
				viewPlaceholder="select a counties geometry view..."
				baseUrl={ baseUrl }/>

			<div className="flex justify-end">
				<Button disabled={ !okToSend }
					onClick={ sendRequest }
				>
					Send Request
				</Button>
			</div>

		</div>
	)
}
export default Create;