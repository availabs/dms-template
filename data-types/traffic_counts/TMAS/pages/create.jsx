import React from "react"

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

  const [inputRef, setInputRef] = React.useState(null);
  const clickInputRef = React.useCallback(() => {
  	if (!inputRef) return;
  	inputRef.click();
  }, [inputRef]);
  const [tmasFile, setTmasFile] = React.useState(null);
  const doSetTmasFile = React.useCallback(e => {
  	setTmasFile(e.target.files[0]);
  }, [setTmasFile]);

  return (
  	<div>
  		<input ref={ setInputRef } type="file" className="hidden"
  			value={ tmasFile }
  			onChange={ doSetTmasFile }/>
  		<button onClick={ clickInputRef }>
  			select file
  		</button>
  	</div>
  	)
}
export default Create;