import React from "react"

import {
	useGetActions,
	useFetchSources
} from "../../actions_location/pages/utils"

import {
	SourceAndViewSelectors,
	LoadingIndicator
} from "../../actions_location/pages/components"

const Create = ({ context, source }) => {

	const theContextStuff = React.useContext(context) || {};

	const { useFalcor, datasources, API_HOST, UI, dmsEnvs, baseUrl } = theContextStuff;
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

	const [locationsSource, setLocationsSource] = React.useState(null);
	const [locationsView, setLocationsView] = React.useState(null);

	const requestArgs = React.useMemo(() => {
		const args = {
			sourceName: source.name,

			actionsSource: actionsSource?.source_id,
			actionsView: actionsView?.view_id,

			locationsSource,
			locationsView
		}
		if (source.source_id) {
			args.sourceId = source.source_id;
		}
		return args;
	}, [source, actionsSource, actionsView, locationsSource, locationsView]);

	const okToSend = React.useMemo(() => {
		if (!API_HOST) return false;
		const { sourceName, ...rest } = requestArgs;
		return (sourceName.length >= 4) &&
						Object.values(rest).reduce((a, c) => a && Boolean(c), true);
	}, [API_HOST, requestArgs]);

	const sendRequest = React.useCallback(() => {
		if (!okToSend) return;
		const url = `${ API_HOST }/dama-admin/${ pgEnv }/actions_cleaned/publish`;
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
				label="Select the Actions Location Source and View (precision + geometry)"
				Select={ Select }
				falcor={ falcor }
				falcorCache={ falcorCache }
				pgEnv={ pgEnv }
				categories={ ["Action Locations"] }
				columns={ ["action_id", "precision"] }
				source_id={ locationsSource }
				setSource={ setLocationsSource }
				sourcePlaceholder="select an actions location source..."
				view_id={ locationsView }
				setView={ setLocationsView }
				viewPlaceholder="select an actions location view..."
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
