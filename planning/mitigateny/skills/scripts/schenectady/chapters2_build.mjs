import fs from 'fs';
const impacts=JSON.parse(fs.readFileSync(new URL('./hazard_impacts.json',import.meta.url)));
const spec=[];
const S=(id,blocks)=>spec.push({id,blocks});
// coalesce helper for extracted impacts blocks (p/li/h)
function coalesce(blocks){const out=[];let buf=null;for(const b of blocks){if(b.t==='li'){if(!buf){buf={t:'ul',items:[]};out.push(buf);}buf.items.push(b.text);continue;}buf=null;out.push(b.t==='h'?{t:'h',text:b.text,tag:'h3'}:{t:'p',text:b.text});}return out;}

// ===== NFIP =====
S("2267136",[
{t:"p",text:`The following provides a snapshot of the National Flood Insurance Program (NFIP) in the county. Due to the nature of the NFIP data, the NFIP information for Villages is included within their respective Towns (in New York State, Villages are included within Towns). At the top, a total number of NFIP Claims and the Total Payments for those claims is displayed. The table shows the total amount of NFIP claims, how many claims were paid, the total amount paid, number of repetitive/severe repetitive loss properties, and number of NFIP policies for each Town in the County. Additionally, due to the structure of the NFIP data there were complications in associating the repetitive loss and severe repetitive loss properties with landuse types (e.g., residential/commercial) in this table.`}
]);
S("2267142",[
{t:"p",text:`NFIP Problem Areas by jurisdiction (as of the end of 2020):`},
{t:"ul",items:[
`Delanson: As of the end of 2020, Duanesburg has 3 active NFIP Policies, and has 3 closed NFIP Claim payouts totaling nearly $20,000. There are no Repetitive or Severe Repetitive Loss Properties identified by the NFIP in Delanson.`,
`Duanesburg: As of the end of 2020, Duanesburg has 10 active NFIP Policies, and has 1 closed NFIP Claims payouts totaling nearly $400. There are 2 Repetitive and 0 Severe Repetitive Loss Properties identified by the NFIP in Duanesburg.`,
`Glenville: As of the end of 2020, Glenville has 11 active NFIP Policies, and has 6 closed NFIP Claims payouts totaling nearly $28,000. There are 3 Repetitive and 1 Severe Repetitive Loss Properties identified by the NFIP in Glenville.`,
`Niskayuna: As of the end of 2020, Niskayuna has 18 active NFIP Policies, and 23 closed NFIP Claims payouts totaling nearly $221,000. There are 9 Repetitive Loss Properties identified by the NFIP in Niskayuna.`,
`Princetown: Princetown has no active NFIP Policies.`,
`Rotterdam: As of the end of 2020, Rotterdam has 14 active NFIP Policies, and has 1 closed NFIP Claim. There are 5 Repetitive and 0 Severe Repetitive Loss Properties identified by the NFIP in Rotterdam.`,
`Schenectady (City): As of the end of 2020, Schenectady has 157 active NFIP Policies, and has 199 closed NFIP Claims payouts totaling over $3,750,000. There are 11 Repetitive and 3 Severe Repetitive Loss Properties identified by the NFIP in Schenectady.`,
`Scotia: As of the end of 2020, Scotia has 61 active NFIP Policies, and has 58 closed NFIP Claims payouts totaling nearly $1,500,000. There are 6 Repetitive and 1 Severe Repetitive Loss Properties identified by the NFIP in Scotia.`]}
]);

// ===== High Hazard Dams =====
S("2266726",[
{t:"ul",items:[
`Class A: Low Hazard - Dam failure may cause relatively minor economic or environmental damage.`,
`Class B: Intermediate Hazard - Dam failure may cause significant economic or environmental damage, but loss of life is not expected. There are about 650 Intermediate Hazard dams in New York.`,
`Class C: High Hazard - Dam failure may cause loss of life or other severe consequences. There are about 421 High Hazard dams in New York.`,
`Class D: No Hazard - Dams which have failed or have been removed and no longer present a risk.`]},
{t:"p",text:`Schenectady County currently has two class C, High Hazard Potential, dams:`},
{t:"ul",items:[
`the Mariaville Lake Dam in the Town of Duanesburg`,
`the Vischer Ferry Dam on the Mohawk River between the Town of Clifton Park in Saratoga County and the Town of Niskayuna in Schenectady County.`]},
{t:"p",text:`Schenectady County currently has one class B, Intermediate Hazard Potential, dam: the Lock E-9 Dam at Rotterdam Junction on the Mohawk River between the Towns of Rotterdam and Glenville.`}
]);

// ===== Capabilities Assessment (slot 0) — Capacity to Address Risk =====
S("2267039",[
{t:"p",text:`A key component to addressing risk across the County is information sharing and plan integration. When communities align their existing government operations and tools such as staff resources, existing plans, technical resources, and funding, they increase the likelihood of plan implementation and their ability to accomplish the goals and objectives of this HMP update.`},
{t:"p",text:`The planning process brought together a wide range of local government staff and officials and facilitated conversations and information sharing about hazard risks, impacts, local capabilities, and strategies to reduce local vulnerabilities. This was an effective process of integration in itself, as it convened staff from many agencies and departments, effectively revitalizing and/or building strategic partnerships. Planning participants communicated about their operational priorities, and increased awareness of existing procedures, plans and resources. They communicated about existing conditions, community needs and objectives and shared information about strengths and challenges related to planning for and implementing long-term risk reduction measures.`},
{t:"p",text:`The County Emergency Management Office is designated to provide the centralized coordination of emergency management activities, including coordination of resources, manpower and services and the centralized direction of requests for assistance, during man-made and natural disasters. At the County level the Emergency Management Office’s responsibilities are closely related to the responsibility of the local levels of government within the County, i.e., the city, towns and incorporated villages, to manage all phases of disasters. The county has the responsibility to assist the local levels of government in the event that they have fully committed their resources and are still unable to cope with any disaster. This office, in concert with the Office of Engineering and Public Works, will support the integration of the mitigation plan’s risk assessment and strategy into regular workflows across departments throughout the County.`},
{t:"p",text:`The County’s Comprehensive Emergency Management Plan (CEMP) is a strong example of integration across County and local planning mechanisms. The CEMP, published in January 2020 by the Office of Emergency Management, enhances the County's ability to manage emergency or disaster situations and provides general, all-hazards management guidance, using existing organizations, to allow Schenectady County and its local municipalities to meet their responsibilities before, during, and after an emergency. This resource was integrated throughout the plan. County and local government officials, in addition to representatives of local businesses and non-profit organizations, participated in preparing the CEMP and there was significant overlap of planning participants and contributors in both the CEMP and HMP updates.`},
{t:"p",text:`The CEMP establishes that the County’s Hazard Mitigation Coordinator will participate as a member of the Schenectady County Local Emergency Planning Committee (LEPC). The LEPC is a community-based organization composed of government officials, emergency response personnel, industry leaders, environmental representatives, media, and interested citizens of Schenectady County. The LEPC has a subcommittee dedicated to the identification and analysis of potential hazards. This subcommittee meets annually to discuss significant changes to the current hazard analysis and identify other potential hazards in the County. The Local Emergency Planning Committee (LEPC) is highly active and meets on the third Thursday of each month at the South Schenectady Fire Department at 12:15pm. The public is welcome to attend.`},
{t:"p",text:`The capabilities assessment by staff across many departments resulted in the evaluation that the County has a strong Mass Fatality Plan that has been exercised. An upgraded alerting system will improve the public notification capabilities of the County. The County benefits from a variety of specialized response teams including a SWAT/Tactical Team and a Water/River Rescue Team. The traditional first responder capabilities are well developed and frequently exercised.`},
{t:"p",text:`Another existing planning mechanism that was extensively utilized during this HMP update is the Schenectady Internet Mapping System (SIMS). The County SIMS is a web-based map interface that includes different geospatial data managed by the County’s Economic Development and Planning Department. The SIMS was utilized throughout the HMP update process and provided data about critical facilities and infrastructure, utilities, parcels, natural resources (waterbodies, wetlands, aquafers, soils, etc.), land use planning (zoning, census tracts, etc.) and district (fire, water, sewer, school, etc.) for each jurisdiction and the County. The SIMS data provided a hyperlocal data foundation for the multidimensional risk assessment.`},
{t:"p",text:`During the HMP update, the Engineering and Public Works department leveraged hazard mitigation grant funding to develop new, customized flood data software, the Real Time Inundation Modeling tool, for use across the County. The tool inserts the National Weather Service’s 3 to 4 day forecast flow data into hydraulic models and utilizes the U.S. Army Corps of Engineers Hydrologic Engineering Center’s River Analysis System (HEC-RAS) program to compute hindcast and forecast within minutes. RTIM provides the ability to insert forecast data into the hydraulic models, run a complete simulation, and develop early warning water surface elevations and flood inundation map to assist in risk analysis. The outputs are shared across County and local agencies, particularly emergency management personnel, and shared with decision makers.`},
{t:"p",text:`The department also continuously implements the County's Stormwater Management (MS4) Program, as do departments in City of Schenectady, Village of Scotia, Towns of Glenville, Niskayuna, Princetown, and Rotterdam. The County lead for the 2021 Schenectady HMP Update, the County's Environmental Programs Manager, Yi-Mei Han, is also the County's Stormwater Management Program Coordinator and MS4 report preparer. These related duties enhance the HMP's relevance and integration in those existing programs.`}
]);

// ===== Climate Change — Climate Smart Community =====
S("2266732",[
{t:"p",text:`In June 2017 Governor Cuomo named Schenectady County New York's 13th Certified Climate Smart Community. Launched in 2014, the Climate Smart Communities Certification Program recognizes local governments that have taken action to reduce emissions and protect their communities from a changing climate. The county's actions to strengthen resiliency and reduce greenhouse gas emissions supports the Governor's aggressive goals to reduce statewide emissions 40 percent by 2030 and reduce emissions 80 percent by 2050.`},
{t:"p",text:`A number of resiliency projects led to the county's certification, including the five-megawatt solar farm on Hetcheltown Road, which is one of several solar photovoltaic installations managed by Schenectady County, including rooftop arrays at five county buildings. The county has additional PV installations planned as part of meeting its goal of achieving energy independence by 2020 through energy efficiency upgrades in county facilities and increases in solar power.`},
{t:"p",text:`Schenectady County has also made progress in reducing greenhouse gases from transportation through a project that increased the efficiency of transporting preschool children with special needs. The county switched from school-based to zone-based bus routes and staggered school start- and end-times. This allowed bus drivers to transport students to and from several schools located within the same zone in a single, direct route. The county further optimized the efficiency of the bus routes by using mapping software to reduce the number of buses needed by 23 percent, avoiding an estimated 18,000 vehicle-miles per year.`},
{t:"p",text:`Schenectady County earned certification points for each of the 10 Climate Smart Community Pledge Elements. This illustrates the county's well-rounded, comprehensive local climate action program that is rooted in strong stakeholder engagement and planning, which includes both mitigation and adaptation. The county has completed climate action plans for both government operations and within the community.`}
]);

// ===== Strategies =====
// Local Context (overview)
S("2267087",[
{t:"p",text:`Overall, across the County, the impacts most likely to occur as a result of natural hazard incidents are; loss of electricity, building damage from floods or severe storms, restriction of travel and other community impacts resulting from accumulations of snow/ice or debris from a severe storm event.`},
{t:"p",text:`Minimizing risk is an essential focus of public safety planning. Every land use or public facility action taken by local government should be based on a recognition that some natural and manmade risk exists. The level of risk involved then becomes critical in determining when government involvement becomes necessary or desirable. The challenge is to balance the probability of potential hazard impacts with the current and proposed land uses and community activities.`}
]);
// County Goals and Objectives
S("2267082",[
{t:"p",text:`This section presents the mitigation goals and objectives identified to reduce or avoid long-term vulnerabilities to the identified hazards. Schenectady County and the eight participating municipalities developed these goals and objectives based on experience since the 2016 plan update, the updated risk assessment and existing resources and capabilities.`},
{t:"p",text:`The mitigation goals serve as general guidelines that clarify desired hazard risk reduction outcomes. They represent a long-term vision for hazard reduction and the enhancement of mitigation capabilities and are compatible with needs and goals expressed in other available emergency planning documents such as the County Comprehensive Emergency Management Plan.`},
{t:"h",text:`Goal 1: Protect life, health, and safety of people, property, and environment.`,tag:"h3"},
{t:"ul",items:[
`Objective 1.1 - Implement building codes to ensure fire safety and building resistance to wind, storm, flood and fire damage through active cooperation between property owners and code enforcement officials.`,
`Objective 1.2 - Promote and encourage the safe use, storage and disposal of hazardous materials to avoid adversely impacting water quality during a flood.`,
`Objective 1.3 - Improve County's ability to provide shelter for residents during long periods of power outage or evacuation.`,
`Objective 1.4 - Promote and continue the use of natural systems and features, open space preservation, and land use development planning with local jurisdictions. To minimize storm water runoff from new development and redevelopment to minimize flood impacts. Guide development in hazard areas (i.e. floodplain, steep slopes) to avoid hazard impacts. Flood prevention through stream and storm drainage structure maintenance or improvement.`,
`Objective 1.5 - Regularly inspect, maintain, and improve stream channels and stormwater drainage structures to mitigate and prevent overland flooding.`]},
{t:"h",text:`Goal 2: Increase Public Awareness to help people care for themselves and their property before, during and after a hazard event.`,tag:"h3"},
{t:"ul",items:[
`Objective 2.1 - Provide information to County residents, schools and businesses to help mitigate and prevent damage to people and property from hazard events.`,
`Objective 2.2 - Offer dedicated education and awareness programs to reduce the impact of hazards on vulnerable populations.`,
`Objective 2.3 - Provide information encouraging emergency supplies and survival kits that would sustain households for 7-10 days.`,
`Objective 2.4 - Provide information to County residents concerning sheltering in place, related to hazards that cause downed power lines or flooding conditions that do not require evacuation.`,
`Objective 2.5 - Promote citizen preparedness through the presentation and publication of the NYS Citizen Preparedness Corps Program either online or in community presentations by the American Red Cross.`,
`Objective 2.6 - Encourage municipalities to become National Weather Service Storm Ready Community.`,
`Objective 2.7 - Develop additional means of communicating hazard warnings to County residents, including increasing cell phone registration with County Emergency Management Office for Smart911.`]},
{t:"h",text:`Goal 3: Encourage Partnerships and Cooperative Agreements to maximize effective use of community resources.`,tag:"h3"},
{t:"ul",items:[
`Objective 3.1 - Develop and maintain an inventory of intermunicipal emergency services, shared equipment and resources, and programs for first responders responding hazard events.`,
`Objective 3.2 - Provide regular training for municipal officials and first responders so there is a standardized approach to command, control and coordinate response to hazard incidents.`,
`Objective 3.3 - Coordinate an emergency response plan between the Red Cross, County, municipalities, school districts and other facilities that host emergency shelters which follows the Incident Command System guidelines.`]},
{t:"h",text:`Goal 4: Reduce hazard risk and build resiliency related to roads, services, utilities, and other critical infrastructure within the County.`,tag:"h3"},
{t:"ul",items:[
`Objective 4.1 - Develop a proactive tree maintenance program to reduce power outages, roadblocks and property damage from falling trees or tree limbs.`,
`Objective 4.2 - Identify critical infrastructure and facilities for flood proofing and flood resilience.`,
`Objective 4.3 - Identify critical infrastructure and facilities that need standby emergency power to preserve public services during a hazard event.`,
`Objective 4.4 - Protect municipal water, wells and reservoir sites from potential contamination by floods or other natural hazard events.`]}
]);
// Problem Area Identification
S("2267162",[
{t:"p",text:`During the planning process Jurisdictional Teams identified problem areas (community, built and natural areas susceptible to hazard related risks and impacts). They evaluated the who, what, when, where, why and how related to the problem area. This evaluation defined each Jurisdiction's hazards of concern and the information they included in the local hazard impacts section of each hazard of concern's profile. The results of each jurisdiction's evaluation were assessed during the mitigation strategy development and sometimes resulted in proposed mitigation actions.`},
{t:"ul",items:[
`The Village of Delanson included risk analysis for coldwave, drought and flooding.`,
`The Town of Duanesburg included risk analysis for coldwave, Ice storms, snow storm, tornado, wind, and flooding.`,
`The Town of Glenville included risk analysis for flooding.`,
`The Town of Niskayuna included risk analysis for drought, flooding, and snow storms.`,
`The Town of Princetown included risk analysis for flooding and landslides.`,
`The Town of Rotterdam included risk analysis for flooding.`,
`The City of Schenectady included risk analysis for flooding, ice storm, snow storm, and wind.`,
`The Village of Scotia included risk analysis for flooding and wind.`]}
]);
// Prioritization & Cost Evaluation
S("2267053",[
{t:"p",text:`In setting priorities for updating the mitigation strategy, planning participants utilized the criteria established in the 2016 HMP and considered the frequency of hazard occurrence, damage caused by the hazard, the cost of proposed mitigation actions, benefits associated with potential mitigation improvements, and the ease of implementation. A more detailed explanation of the prioritization criteria used to assess all potential mitigation actions can be found below. The updated Goals and Objectives reflect input and revision from all participating jurisdictions.`}
]);
// Plan for Displaced Residents
S("2267146",[
{t:"p",text:`Intermediate and long-term housing options are available for relocating displaced residents and maintaining post-disaster social and economic stability.`},
{t:"p",text:`Examples of potential intermediate/temporary locations include existing mobile home parks; recreational vehicle/camping grounds; public or private land or parkland; or a site easily convertible for the placement of temporary housing units. If a hazard event causes population displacement, having an inventory of designated locations known as Relocation Zones will provide temporary sites to accommodate residents.`},
{t:"p",text:`Long-term/permanent housing may be needed when structures located in the Special Flood Hazard Area need to be relocated, or new properties must be built once severely damaged properties are razed. In instances of long-term needs in which residents need new permanent housing Jurisdictions must identify all suitable sites currently owned by the jurisdiction and potential sites under private ownership that meet applicable local zoning requirements and floodplain laws.`}
]);
// Evacuation Procedures
S("2267150",[
{t:"p",text:`Evacuation routes and procedures to remove citizens from a vulnerable location prior to and during an incident is necessary to protect residents and mitigate risk, stress and personal hardships during hazard events.`}
]);
// Shelters
S("2267152",[
{t:"p",text:`Schenectady County’s Mass Care and Sheltering Annex was recently updated in November 2020. This plan outlines organizational arrangements, operational concepts, responsibilities and procedures to protect evacuees and others from the effects of an emergency situation by providing shelter and mass care.`},
{t:"p",text:`Shelter and mass care needs may range from very short term operations for a limited number of people where the primary objective is to provide protection from the weather, comfortable seating and access to rest rooms to more lengthy operations for a large number of evacuees where feeding, sleeping and shower facilities are desirable and a variety of assistance must be provided to evacuees. Schenectady County has the ultimate responsibility for providing shelter and mass care to protect local residents displaced from their homes and others who evacuate into our jurisdiction due to emergency situations.`},
{t:"p",text:`The American Red Cross has been chartered under federal law to provide mass care to victims of natural disasters. Therefore, the County’s efforts are coordinated with the American Red Cross, which will normally operate shelter and mass care operations insofar as its capabilities permit. If American Red Cross services are not available, other volunteer organizations and religious groups may open shelters.`},
{t:"p",text:`Additionally, the County has 600 cots and blankets with two 2 trailers ready to deploy. The ARC can bring in more cots as necessary. The County has a mutual aid agreement with Schoharie County for use of the County Animal Response Team (CART).`},
{t:"p",text:`For health reasons, pets are not allowed in emergency shelters operated by the American Red Cross and most other organized volunteer groups. However, a number of studies have indicated that some people, particularly the elderly, will not leave their homes if they cannot take their pets with them. Therefore, it is desirable to make reasonable arrangements for evacuees who come to public shelters with pets. The Schenectady County Animal Response Team will set up temporary pet shelters at locations that have been predetermined by them.`}
]);

// ===== Natural Hazards — All Hazards content -> Local Context =====
S("2266803", coalesce(impacts['All Hazards']));

fs.writeFileSync(new URL('../edits/chapters2.json',import.meta.url), JSON.stringify(spec,null,1));
console.log('wrote chapters2.json with',spec.length,'slots');
