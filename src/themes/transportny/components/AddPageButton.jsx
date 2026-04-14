import React, {useContext, useEffect, useState, useRef} from "react";
import {NavLink, useSubmit, useLocation, useNavigate} from "react-router";
import {ComponentContext} from "~/dms/packages/dms/src/patterns/page/context";
import { CMSContext } from '~/dms/packages/dms/src'
import { ThemeContext } from '~/dms/packages/dms/src/ui/useTheme'

const customTheme = {
    nav: {
        container: (open) => open ? `w-1/4 max-w-[25%] border-r overflow-hidden` : `hidden`,
        navItemContainer: 'max-h-[80vh] w-full overflow-y-auto overflow-x-hidden pt-3 scrollbar-xs',
        navItem: ({isActive, isPending}) =>
            `block px-4 py-2 font-light ${isActive ?
                'w-[256px] bg-white text-blue-500 border-l border-y' :
                'w-[248px] hover:bg-blue-100 text-slate-600'
            }`,
        navItemChild: ({isActive, isPending}) =>
            `block px-4 py-2 font-light ${isActive ?
                'w-[238px] bg-white text-blue-500 border-l border-y' :
                'w-[230px] hover:bg-blue-100 text-slate-600'
            }`,
        AddPageButton: 'w-[230px] cursor-pointer px-4 py-2 mt-3 bg-[#1a46b3] hover:bg-blue-500 text-white border-1 border-slate-200 font-bold',
        expandCollapseButton: 'p-0.5 h-fit w-fit rounded-md text-blue-400 text-xs  hover:text-blue-500'
    },
  page: {
        pageContainer: (small) => `border max-h-[80vh] ${small ? `max-w-[90%] w-[90%]` : `max-w-[100%]`} overflow-y-auto overflow-x-auto scrollbar-xs`,
  }
}
const toSnakeCase = str =>
  str &&
  str
    .match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g)
    .map(x => x.toLowerCase())
    .join('_');

const isJson = (str) => {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}
const getParentSlug = (item, dataItems) => {
  if(!item.parent) {
    return ''
  }
  let parent = dataItems.filter(d => d.id === item.parent)[0]
  return `${parent.url_slug}/`
}
const getUrlSlug = (item, dataItems) => {
  let slug =  `${getParentSlug(item, dataItems)}${toSnakeCase(item.title)}`

  if((item.url_slug && item.url_slug === slug) || !dataItems.map(d => d.url_slug).includes(slug)) {
    return slug
  }
  return `${slug}_${item.index}`
}
export const json2DmsForm = (data,requestType='update') => {
  let out = new FormData()
  out.append('data', JSON.stringify(data))
  out.append('requestType', requestType)
  //console.log(out)
  return out
}



function AddPageButton(props) {
    const {state, setState} = useContext(ComponentContext);
    const [modalOpen, setModalOpen] = useState(false);
    //const {dataItems} = props;
    const submit = useSubmit();
    const {pathname = '/edit'} = useLocation();
    const {baseUrl, user} = React.useContext(CMSContext);

    const newItem = {
        title: 'New Page',
        //index: highestIndex + 1,
        published: 'draft',
        hide_in_nav: "hide",
        authPermissions:{"users":{[user.id]:["*"]},"groups":{}},
        history: [{
            type: ' created Page.',
            user: user.email,
            time: new Date().toString()
        }],
    }

    const addItem = ({item}) => {
        submit(json2DmsForm(item), {method: "post", action: pathname});
        setModalOpen(false);
    }
    return (
        <>
        <NamePageModal open={modalOpen} setOpen={setModalOpen} addItem={addItem} item={newItem} title="Create Page"/>
        <div className='pr-2'>
            <div
                onClick={() =>setModalOpen(true)}
                className={customTheme.nav.AddPageButton}
            >
                + Add Page
            </div>
        </div>
        </>
    )
}

function NamePageModal({title, prompt, item = {}, open, setOpen, addItem}) {
  const cancelButtonRef = useRef(null)
  const {UI, theme} = React.useContext(ThemeContext);
  const {Dialog, Input} = UI
  const [itemName, setItemName] = useState('');

  return (
        <Dialog
            open={open}
            initialFocus={cancelButtonRef}
        >
            <div className="sm:flex sm:items-start z-50">
                <div
                    className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                    {theme.Icons.Add()}
                </div>
                <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                    <h3 className="text-base font-semibold leading-6 text-gray-900">
                        {title}
                    </h3>
                    <div className="mt-2">
                        <p className="text-sm text-gray-500">
                            <label>Page Title</label>
                            <Input
                                placeHolder="Enter a page title..."
                                value={itemName}
                                onChange={(e) => {setItemName(e.target.value)}}
                            />
                        </p>
                    </div>
                </div>
            </div>
            <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                    type="button"
                    disabled={!itemName}
                    className="cursor-pointer disabled::cursor-not-allowed inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 sm:ml-3 sm:w-auto"
                    onClick={() => addItem({item:{...item, title: itemName, url_slug:toSnakeCase(itemName)}})}
                >
                    Create Page
                </button>
                <button
                    type="button"
                    className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                    onClick={() => setOpen(false)}
                    ref={cancelButtonRef}
                >
                    Cancel
                </button>
            </div>
        </Dialog>
  )

}

export default {
    name: 'Add Page Button',
    EditComp: AddPageButton,
    ViewComp: AddPageButton,
}
