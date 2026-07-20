import React from "react"

import {
	useGetSources,
	useFetchSourceViews,
	useGetViews
} from "./utils"

const DefaultLabelAccessor = o => o.label;
const DefaultValueAccessor = o => o.value;

export const SimpleSelect = props => {

	const {
		options,
		onChange,
		value,
		labelAccessor = DefaultLabelAccessor,
		valueAccessor = DefaultValueAccessor,
		placeholder,
		disabled
	} = props;

	const doOnChange = React.useCallback(e => {
		onChange(e.target.value);
	}, [onChange]);

	return (
		<select
			className={ `
				block w-full rounded-lg cursor-pointer border py-1 px-2
				${ !value ? "focus:outline-red-500 outline-red-500 outline-2 border-transparent" : "border-zinc-950/10 focus:outline-none" }
			` }
			style={ { outlineOffset: "-1px" } }
			value={ value || "none" }
			onChange={ doOnChange }
			placeholder={ placeholder }
			disabled={ disabled }
		>
			<option hidden value="none">
				{ placeholder }
			</option>
			{ options.map(o => (
					<option key={ valueAccessor(o) }
						value={ valueAccessor(o) }
					>
						{ labelAccessor(o) }
					</option>
				))
			}
		</select>
	)
}

export const LoadingIndicator = ({ loading }) => {
	const stopTheProp = React.useCallback(e => {
		e.stopPropagation();
	}, []);
	return !loading ? null : (
			<div onClick={ stopTheProp }
				className={ `
					absolute inset-[-0.25rem] bg-black/75 rounded-lg
					flex items-center justify-center z-50
					text-4xl font-extrabold text-white
				` }
			>
				LOADING
			</div>
		)
}

const sourceValueAccessor = src => src.source_id;
const sourceLabelAccessor = src => src.display_name || src.name;

const viewValueAccessor = view => view.view_id;
const viewLabelAccessor = view => view.version || `view ${ view.view_id }`;

export const SourceAndViewSelectors = props => {
	const {
		Select,
		falcor, falcorCache, pgEnv,
		categories = [],
		columns = [],
		source_id,
		setSource,
		sourcePlaceholder,
		view_id,
		setView,
		viewPlaceholder,
		label,
		baseUrl
	} = props;

	const [loading, setLoading] = React.useState(0);
	const startLoading = React.useCallback((n = 1) => {
		setLoading(loading => loading + n);
	}, []);
	const stopLoading = React.useCallback((n = -1) => {
		setLoading(loading => loading + n);
	}, []);

	const sources = useGetSources({ falcorCache, pgEnv, categories, columns });

	useFetchSourceViews({ falcor, falcorCache, pgEnv, source_id, startLoading, stopLoading });

	const views = useGetViews({ falcorCache, pgEnv, source_id });

	const doSetSourceId = React.useCallback(sid => {
		setView(null);
		setSource(sid);
	}, [setSource, setView]);

	return (
		<div className="relative">
			<div className="font-bold">
				{ label }
			</div>
			<div className="relative">
				<LoadingIndicator loading={ Boolean(loading) }/>

				<List Select={ Select }
					placeholder={ sourcePlaceholder }
					data={ sources }
					value={ source_id }
					onChange={ doSetSourceId }
					disabled={ Boolean(loading) }
					valueAccessor={ sourceValueAccessor }
					labelAccessor={ sourceLabelAccessor  }/>

				{ !source_id ? null :
					<div className="mt-1">
						<List Select={ Select }
							placeholder={ viewPlaceholder }
							data={ views }
							value={ view_id }
							onChange={ setView }
							disabled={ Boolean(loading) }
							valueAccessor={ viewValueAccessor }
							labelAccessor={ viewLabelAccessor  }/>
					</div>
				}
			</div>
			{ !source_id ? null :
				<div className="text-sm">
					<a href={ `${ baseUrl }/source/${ source_id }`}
						className="text-blue-400 hover:text-blue-600"
						target="_blank"
					>
						view source <i className="fa-light fa-sm fa-arrow-up-right-from-square"/>
					</a>
				</div>
			}
		</div>
	)
}

const List = props => {
	const {
		label,
		Select,
		data,
		onChange,
		value,
		placeholder,
		disabled,
		valueAccessor,
		labelAccessor
	} = props;

	const options = React.useMemo(() => {
		return data.map(d => {
			return {
				value: valueAccessor(d),
				label: labelAccessor(d)
			}
		})
	}, [data, valueAccessor, labelAccessor]);

	React.useEffect(() => {
		if ((options.length === 1) && (value === null)) {
			onChange(options[0].value);
		}
	}, [options]);

	return (
		<div
			className={ `
				rounded-lg ${ !value ? "outline-red-500 outline-2" : "" }
			` }
			style={ { outlineOffset: value ? "-1px" : null } }
		>
			<Select disabled={ disabled }
				placeholder={ placeholder }
				options={ options }
				onChange={ onChange }
				value={ value }/>
		</div>
	)
}