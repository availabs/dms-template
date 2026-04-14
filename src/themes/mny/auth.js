import React from 'react'
import {Link} from 'react-router'


const theme = {
    authPages: {
        container: `bg-[linear-gradient(0deg,rgba(244,244,244,0.96),rgba(244,244,244,0.96)),url('/themes/mny/topolines.png')]  bg-[size:500px] pb-[4px]`,//`bg-gradient-to-b from-[#F4F4F4] to-[#F4F4F4] bg-[url('/themes/mny/topolines.png')] `,
        wrapper1: 'w-full h-full flex-1 flex flex-col ', // first div inside Layout
        wrapper2: 'w-full h-full flex-1 flex flex-row p-4 min-h-screen', // inside page header, wraps sidebar
        wrapper3: 'flex flex-1 w-full border-2 flex-col border shadow-md rounded-lg relative text-md font-light leading-7 p-4',
        iconWrapper: 'z-5 absolute right-[10px] top-[5px]',
        icon: 'text-slate-400 hover:text-blue-500',
        sectionGroup: {
            default: {
                wrapper1: "w-screen h-screen flex flex-row", // inside page header, wraps sidebar
                wrapper2: "flex w-screen h-screen justify-center",
                wrapper3: "w-full md:w-1/2 place-content-start md:place-content-center px-32",
                wrapper4: "relative hidden md:flex items-center xl:items-start w-1/2 bg-[linear-gradient(258.63deg,#213440_10%,#37576B_100%)]",
                wrapper4Img: "absolute w-full aspect-square left-[4vw] md:left-[0vw] lg:left-[-5vw] xl:left-[-10vw] bg-contain xl:bg-cover bg-bottom xl:bg-top bg-no-repeat",
                wrapper4ImgList: [
                    '/themes/mny/hazards/mny-avalanche.webp',
                    '/themes/mny/hazards/mny-drought.webp',
                    '/themes/mny/hazards/mny-earthquake.webp',
                    '/themes/mny/hazards/mny-extreme-cold.webp',
                    '/themes/mny/hazards/mny-extreme-heat.webp',
                    '/themes/mny/hazards/mny-flood.webp',
                    '/themes/mny/hazards/mny-hail.webp',
                    '/themes/mny/hazards/mny-hurricane.webp',
                    '/themes/mny/hazards/mny-ice-strom.webp',
                    '/themes/mny/hazards/mny-landslide.webp',
                    '/themes/mny/hazards/mny-lightning.webp',
                    '/themes/mny/hazards/mny-snowstorm.webp',
                    '/themes/mny/hazards/mny-tornado.webp',
                    '/themes/mny/hazards/mny-wildfire.webp',
                    '/themes/mny/hazards/mny-wind.webp',
                ],
                iconWrapper: "z-5 absolute right-[10px] top-[5px] print:hidden",
                icon: "text-slate-400 hover:text-blue-500",
                sideNavContainer1: "hidden xl:block",
                sideNavContainer2:
                    "min-w-[302px] max-w-[302px] sticky top-20 hidden xl:block h-[100vh_-_102px] pr-2",
                pageWrapper: "max-w-lg mx-auto my-auto flex flex-col gap-[2vh] p-4",
                pageTitle: "font-[Oswald] font-medium text-[#2D3E4C] text-2xl leading-none tracking-normal uppercase",
                forgotPasswordText: "font-[Proxima_Nova] font-normal text-[#37576B] text-sm leading-none tracking-normal underline decoration-solid",
                actionButton: "w-fit opacity-100 gap-2 rounded-full px-6 py-2 bg-[#EAAD43] cursor-pointer",
                actionText: "font-['Proxima_Nova'] font-bold text-[#2D3E4C] text-xs leading-none tracking-normal text-center uppercase",
                prompt: "font-[Proxima_Nova] font-normal text-[#37576B] text-sm leading-none tracking-normal flex gap-1",
            },
        },
    },
    field: {
        fieldWrapper: "flex flex-col gap-[2vh]",
        field: "flex flex-col gap-[1vh]",
        label: "font-[Proxima Nova] font-semibold text-[#37576B] text-sm leading-none tracking-normal"
    }
}

export default theme
