-- =============================================================================
-- Seed: Development data for OpenGive dashboard
-- Idempotent: all inserts use ON CONFLICT DO NOTHING
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ORGANIZATIONS (50 total: US×20, UK×15, CA×5, AU×5, IN×5)
-- ---------------------------------------------------------------------------

INSERT INTO organizations (
  id, name, slug, org_type, sector, mission,
  country_code, jurisdiction, registry_source, registry_id,
  registration_date, status, website, city, state_province,
  data_completeness
) VALUES

-- ── United States (20) ──────────────────────────────────────────────────────

('550e8400-e29b-41d4-a716-446655440001',
 'American Red Cross', 'american-red-cross',
 'nonprofit', 'disaster_relief',
 'The American Red Cross prevents and alleviates human suffering in the face of emergencies by mobilizing the power of volunteers and the generosity of donors.',
 'US', 'DC', 'us_propublica', '53-0196605',
 '1900-01-05', 'active', 'https://www.redcross.org', 'Washington', 'DC', 0.97),

('550e8400-e29b-41d4-a716-446655440002',
 'Feeding America', 'feeding-america',
 'nonprofit', 'poverty',
 'Feeding America advances change in America by ensuring equitable access to nutritious food for all in partnership with food banks, policymakers, supporters, and the communities we serve.',
 'US', 'IL', 'us_propublica', '36-3673599',
 '1979-09-12', 'active', 'https://www.feedingamerica.org', 'Chicago', 'IL', 0.95),

('550e8400-e29b-41d4-a716-446655440003',
 'Doctors Without Borders USA', 'doctors-without-borders-usa',
 'nonprofit', 'health',
 'Médecins Sans Frontières delivers emergency medical care to people caught in crisis, regardless of race, religion, or political affiliation.',
 'US', 'NY', 'us_propublica', '13-3433452',
 '1990-03-15', 'active', 'https://www.doctorswithoutborders.org', 'New York', 'NY', 0.96),

('550e8400-e29b-41d4-a716-446655440004',
 'Bill & Melinda Gates Foundation', 'gates-foundation',
 'foundation', 'health',
 'The Gates Foundation works to help all people lead healthy, productive lives by improving global health, reducing poverty, and expanding educational opportunity.',
 'US', 'WA', 'us_propublica', '56-2618866',
 '2000-01-01', 'active', 'https://www.gatesfoundation.org', 'Seattle', 'WA', 0.99),

('550e8400-e29b-41d4-a716-446655440005',
 'United Way Worldwide', 'united-way-worldwide',
 'nonprofit', 'poverty',
 'United Way fights for the health, education, and financial stability of every person in every community through mobilizing millions of people to take action and advance the common good.',
 'US', 'VA', 'us_propublica', '13-1635294',
 '1918-06-01', 'active', 'https://www.unitedway.org', 'Alexandria', 'VA', 0.94),

('550e8400-e29b-41d4-a716-446655440006',
 'Nature Conservancy', 'nature-conservancy',
 'nonprofit', 'environment',
 'The Nature Conservancy is a global environmental nonprofit working to create a world where people and nature can thrive by protecting lands and waters.',
 'US', 'VA', 'us_propublica', '53-0242652',
 '1951-11-15', 'active', 'https://www.nature.org', 'Arlington', 'VA', 0.96),

('550e8400-e29b-41d4-a716-446655440007',
 'Habitat for Humanity International', 'habitat-for-humanity',
 'nonprofit', 'poverty',
 'Habitat for Humanity builds strength, stability, and self-reliance through shelter by helping families build and improve places to call home.',
 'US', 'GA', 'us_propublica', '91-1914868',
 '1976-08-23', 'active', 'https://www.habitat.org', 'Americus', 'GA', 0.93),

('550e8400-e29b-41d4-a716-446655440008',
 'World Wildlife Fund', 'world-wildlife-fund',
 'nonprofit', 'environment',
 'WWF works to conserve nature and reduce the most pressing threats to the diversity of life on Earth, addressing climate, food, freshwater, wildlife, forests, and oceans.',
 'US', 'DC', 'us_propublica', '52-1693387',
 '1961-09-11', 'active', 'https://www.worldwildlife.org', 'Washington', 'DC', 0.95),

('550e8400-e29b-41d4-a716-446655440009',
 'Save the Children Federation', 'save-the-children',
 'nonprofit', 'education',
 'Save the Children gives children a healthy start in life, the opportunity to learn, and protection from harm by transforming lives through immediate and lasting change.',
 'US', 'CT', 'us_propublica', '06-0726487',
 '1932-03-01', 'active', 'https://www.savethechildren.org', 'Fairfield', 'CT', 0.96),

('550e8400-e29b-41d4-a716-446655440010',
 'CARE USA', 'care-usa',
 'nonprofit', 'poverty',
 'CARE works around the globe to save lives, defeat poverty, and achieve social justice by placing special focus on working alongside women and girls.',
 'US', 'GA', 'us_propublica', '13-1685039',
 '1945-11-27', 'active', 'https://www.care.org', 'Atlanta', 'GA', 0.94),

('550e8400-e29b-41d4-a716-446655440011',
 'Sunrise Education Fund', 'sunrise-education-fund',
 'foundation', 'education',
 'The Sunrise Education Fund expands access to quality education for underserved youth in the American South through scholarships, teacher training, and school infrastructure grants.',
 'US', 'TX', 'us_propublica', '47-3821056',
 '2005-04-18', 'active', 'https://www.sunriseedfund.org', 'Houston', 'TX', 0.88),

('550e8400-e29b-41d4-a716-446655440012',
 'Great Lakes Environmental Alliance', 'great-lakes-environmental-alliance',
 'nonprofit', 'environment',
 'The Great Lakes Environmental Alliance protects the ecological integrity of the Great Lakes basin through advocacy, restoration projects, and community science programs.',
 'US', 'MI', 'us_propublica', '38-2947631',
 '1992-07-30', 'active', 'https://www.greatlakesalliance.org', 'Ann Arbor', 'MI', 0.85),

('550e8400-e29b-41d4-a716-446655440013',
 'Pacific Arts Collective', 'pacific-arts-collective',
 'nonprofit', 'arts',
 'The Pacific Arts Collective brings free and accessible arts programming to low-income communities across the Pacific Coast, fostering creative expression and cultural heritage.',
 'US', 'CA', 'us_propublica', '94-2813407',
 '1998-02-14', 'active', 'https://www.pacificartsco.org', 'San Francisco', 'CA', 0.82),

('550e8400-e29b-41d4-a716-446655440014',
 'Appalachian Health Initiative', 'appalachian-health-initiative',
 'nonprofit', 'health',
 'The Appalachian Health Initiative improves health outcomes in rural Appalachian communities through mobile clinics, preventive care programs, and health worker training.',
 'US', 'KY', 'us_propublica', '61-1592084',
 '2003-09-22', 'active', 'https://www.appalachianhealth.org', 'Lexington', 'KY', 0.80),

('550e8400-e29b-41d4-a716-446655440015',
 'Clearwater Veterans Support Network', 'clearwater-veterans-support',
 'nonprofit', 'social_services',
 'Clearwater Veterans Support Network provides housing, mental health, and employment services to veterans and their families transitioning to civilian life.',
 'US', 'FL', 'us_propublica', '59-3748201',
 '2007-11-11', 'active', 'https://www.clearwatervets.org', 'Tampa', 'FL', 0.79),

('550e8400-e29b-41d4-a716-446655440016',
 'Midwest Food Bank', 'midwest-food-bank',
 'nonprofit', 'poverty',
 'Midwest Food Bank provides emergency food relief and nutritional support to individuals and families experiencing food insecurity across the Midwest region.',
 'US', 'IL', 'us_propublica', '37-1492805',
 '2000-05-09', 'active', 'https://www.midwestfoodbank.org', 'Normal', 'IL', 0.86),

('550e8400-e29b-41d4-a716-446655440017',
 'Digital Equity Foundation', 'digital-equity-foundation',
 'foundation', 'education',
 'The Digital Equity Foundation closes the digital divide by distributing refurbished devices, funding broadband access, and delivering digital literacy training in underserved communities.',
 'US', 'WA', 'us_propublica', '91-2047391',
 '2011-03-17', 'active', 'https://www.digitalequityfdn.org', 'Seattle', 'WA', 0.84),

('550e8400-e29b-41d4-a716-446655440018',
 'Border Community Health Services', 'border-community-health',
 'nonprofit', 'health',
 'Border Community Health Services delivers bilingual primary care, dental, and mental health services to uninsured and underinsured residents along the US-Mexico border.',
 'US', 'TX', 'us_propublica', '74-3018526',
 '1995-06-01', 'active', 'https://www.bordercommhealth.org', 'El Paso', 'TX', 0.77),

('550e8400-e29b-41d4-a716-446655440019',
 'Heritage Conservation Trust', 'heritage-conservation-trust',
 'trust', 'arts',
 'The Heritage Conservation Trust preserves and restores historic landmarks, cultural artifacts, and oral histories of Indigenous and immigrant communities across the American Southwest.',
 'US', 'NM', 'us_propublica', '85-0492371',
 '1988-10-03', 'inactive', 'https://www.heritagetrust.org', 'Santa Fe', 'NM', 0.71),

('550e8400-e29b-41d4-a716-446655440020',
 'Gulf Coast Disaster Relief Fund', 'gulf-coast-disaster-relief',
 'nonprofit', 'disaster_relief',
 'The Gulf Coast Disaster Relief Fund coordinates rapid-response financial assistance and rebuilding grants for communities affected by hurricanes and flooding in the Gulf Coast region.',
 'US', 'LA', 'us_propublica', '72-1638490',
 '2005-09-15', 'active', 'https://www.gulfcoastrelief.org', 'New Orleans', 'LA', 0.83),

-- ── United Kingdom (15) ──────────────────────────────────────────────────────

('550e8400-e29b-41d4-a716-446655440021',
 'Oxfam GB', 'oxfam-gb',
 'charity', 'poverty',
 'Oxfam is a global movement of people working together to end the injustice of poverty by tackling inequalities and challenging the systems that keep people poor.',
 'GB', 'England', 'uk_charity_commission', '202918',
 '1942-10-05', 'active', 'https://www.oxfam.org.uk', 'Oxford', 'England', 0.97),

('550e8400-e29b-41d4-a716-446655440022',
 'British Red Cross Society', 'british-red-cross',
 'charity', 'disaster_relief',
 'The British Red Cross helps people in crisis, whoever and wherever they are, by connecting human kindness with human crisis through local volunteers and global networks.',
 'GB', 'England', 'uk_charity_commission', '220949',
 '1870-08-04', 'active', 'https://www.redcross.org.uk', 'London', 'England', 0.96),

('550e8400-e29b-41d4-a716-446655440023',
 'Save the Children UK', 'save-the-children-uk',
 'charity', 'education',
 'Save the Children fights for children every single day so that they can make their mark on the world and build a better future through improved education, health, and protection.',
 'GB', 'England', 'uk_charity_commission', '213890',
 '1919-05-19', 'active', 'https://www.savethechildren.org.uk', 'London', 'England', 0.95),

('550e8400-e29b-41d4-a716-446655440024',
 'Cancer Research UK', 'cancer-research-uk',
 'charity', 'health',
 'Cancer Research UK funds and carries out research with the aim of understanding cancer better and developing new ways to prevent, diagnose, and treat cancer.',
 'GB', 'England', 'uk_charity_commission', '1089464',
 '2002-02-04', 'active', 'https://www.cancerresearchuk.org', 'London', 'England', 0.98),

('550e8400-e29b-41d4-a716-446655440025',
 'Wellcome Trust', 'wellcome-trust',
 'foundation', 'health',
 'Wellcome is a politically and financially independent global charitable foundation that supports scientists and researchers, takes on big health challenges, and campaigns for better science.',
 'GB', 'England', 'uk_charity_commission', '210183',
 '1936-07-01', 'active', 'https://www.wellcome.org', 'London', 'England', 0.99),

('550e8400-e29b-41d4-a716-446655440026',
 'National Trust', 'national-trust',
 'charity', 'arts',
 'The National Trust looks after special places for ever, for everyone, caring for the nature, beauty, and history of the United Kingdom in trust for the nation.',
 'GB', 'England', 'uk_charity_commission', '205846',
 '1895-01-12', 'active', 'https://www.nationaltrust.org.uk', 'Swindon', 'England', 0.94),

('550e8400-e29b-41d4-a716-446655440027',
 'Age UK', 'age-uk',
 'charity', 'social_services',
 'Age UK provides companionship, support, and local services that help people love later life, while campaigning for changes that make the UK a better place to grow old.',
 'GB', 'England', 'uk_charity_commission', '1128267',
 '2009-11-01', 'active', 'https://www.ageuk.org.uk', 'London', 'England', 0.93),

('550e8400-e29b-41d4-a716-446655440028',
 'RNLI — Royal National Lifeboat Institution', 'rnli',
 'charity', 'disaster_relief',
 'The RNLI saves lives at sea by providing a 24-hour on-call lifeboat search and rescue service and promoting safety through education and prevention programmes.',
 'GB', 'England', 'uk_charity_commission', '209603',
 '1824-03-04', 'active', 'https://www.rnli.org', 'Poole', 'England', 0.92),

('550e8400-e29b-41d4-a716-446655440029',
 'Greenpeace UK', 'greenpeace-uk',
 'charity', 'environment',
 'Greenpeace UK defends the natural world and promotes peace by investigating, exposing, and confronting environmental abuse through creative campaigns and global solidarity.',
 'GB', 'England', 'uk_charity_commission', '1314381',
 '2007-04-10', 'active', 'https://www.greenpeace.org.uk', 'London', 'England', 0.88),

('550e8400-e29b-41d4-a716-446655440030',
 'Mind — Mental Health Charity', 'mind-mental-health',
 'charity', 'health',
 'Mind provides advice and support to empower anyone experiencing a mental health problem, while campaigning to improve services, raise awareness, and promote understanding.',
 'GB', 'England', 'uk_charity_commission', '219830',
 '1946-01-01', 'active', 'https://www.mind.org.uk', 'London', 'England', 0.91),

('550e8400-e29b-41d4-a716-446655440031',
 'Shelter UK', 'shelter-uk',
 'charity', 'poverty',
 'Shelter helps millions of people every year struggling with bad housing or homelessness through advice, support, and legal services, while campaigning for systemic change.',
 'GB', 'England', 'uk_charity_commission', '263710',
 '1966-12-01', 'active', 'https://www.shelter.org.uk', 'London', 'England', 0.90),

('550e8400-e29b-41d4-a716-446655440032',
 'WWF-UK', 'wwf-uk',
 'charity', 'environment',
 'WWF-UK works to stop the degradation of the planet''s natural environment and to build a future in which humans live in harmony with nature through conservation and advocacy.',
 'GB', 'England', 'uk_charity_commission', '1081247',
 '2000-09-14', 'active', 'https://www.wwf.org.uk', 'Woking', 'England', 0.93),

('550e8400-e29b-41d4-a716-446655440033',
 'Northern Arts Development Trust', 'northern-arts-development-trust',
 'trust', 'arts',
 'The Northern Arts Development Trust supports emerging artists and community arts projects across Northern England through grants, residencies, and capacity-building programmes.',
 'GB', 'England', 'uk_charity_commission', '1178934',
 '2016-03-22', 'active', 'https://www.northernarts.org.uk', 'Manchester', 'England', 0.78),

('550e8400-e29b-41d4-a716-446655440034',
 'Scottish Rural Education Foundation', 'scottish-rural-education-foundation',
 'foundation', 'education',
 'The Scottish Rural Education Foundation advances educational attainment and lifelong learning for children and adults in remote rural communities across Scotland.',
 'GB', 'Scotland', 'uk_charity_commission', 'SC049812',
 '2014-08-01', 'active', 'https://www.scotruralledu.org.uk', 'Inverness', 'Scotland', 0.76),

('550e8400-e29b-41d4-a716-446655440035',
 'Wales Community Rebuild Fund', 'wales-community-rebuild-fund',
 'charity', 'poverty',
 'The Wales Community Rebuild Fund provides emergency grants and long-term investment to communities in Wales affected by industrial decline and economic deprivation.',
 'GB', 'Wales', 'uk_charity_commission', '1192047',
 '2018-11-05', 'inactive', 'https://www.walesrebuild.org.uk', 'Cardiff', 'Wales', 0.68),

-- ── Canada (5) ───────────────────────────────────────────────────────────────

('550e8400-e29b-41d4-a716-446655440036',
 'Canadian Red Cross', 'canadian-red-cross',
 'nonprofit', 'disaster_relief',
 'The Canadian Red Cross helps people and communities in Canada and around the world in times of need and supports them in strengthening their resilience through disaster response and health programs.',
 'CA', 'ON', 'ca_cra', '129029471RR0001',
 '1896-05-16', 'active', 'https://www.redcross.ca', 'Ottawa', 'ON', 0.94),

('550e8400-e29b-41d4-a716-446655440037',
 'Aga Khan Foundation Canada', 'aga-khan-foundation-canada',
 'foundation', 'poverty',
 'The Aga Khan Foundation Canada supports long-term sustainable development programmes that provide lasting improvements to the quality of life for disadvantaged communities.',
 'CA', 'ON', 'ca_cra', '122666486RR0001',
 '1981-04-28', 'active', 'https://www.akfc.ca', 'Ottawa', 'ON', 0.91),

('550e8400-e29b-41d4-a716-446655440038',
 'Doctors Without Borders Canada', 'msf-canada',
 'nonprofit', 'health',
 'MSF Canada supports the international humanitarian medical work of Médecins Sans Frontières through fundraising, public advocacy, and recruitment of Canadian medical professionals.',
 'CA', 'ON', 'ca_cra', '127557089RR0001',
 '1991-01-01', 'active', 'https://www.msf.ca', 'Toronto', 'ON', 0.92),

('550e8400-e29b-41d4-a716-446655440039',
 'Boreal Forest Keepers Society', 'boreal-forest-keepers',
 'nonprofit', 'environment',
 'Boreal Forest Keepers Society protects Canada''s boreal forest through Indigenous-led conservation partnerships, policy advocacy, and scientific research on forest ecosystems.',
 'CA', 'AB', 'ca_cra', '843291057RR0001',
 '2003-07-19', 'active', 'https://www.borealkeepers.ca', 'Edmonton', 'AB', 0.83),

('550e8400-e29b-41d4-a716-446655440040',
 'First Nations Education Alliance', 'first-nations-education-alliance',
 'nonprofit', 'education',
 'The First Nations Education Alliance advances Indigenous education sovereignty by supporting community-controlled schools, language revitalization, and post-secondary pathways for First Nations youth.',
 'CA', 'MB', 'ca_cra', '761834920RR0001',
 '1997-09-03', 'active', 'https://www.fnealliance.ca', 'Winnipeg', 'MB', 0.85),

-- ── Australia (5) ────────────────────────────────────────────────────────────

('550e8400-e29b-41d4-a716-446655440041',
 'Australian Red Cross', 'australian-red-cross',
 'charity', 'disaster_relief',
 'Australian Red Cross supports people and communities in times of vulnerability by delivering humanitarian programs, disaster response, and migration support services.',
 'AU', 'VIC', 'au_acnc', 'ABN 50 169 561 394',
 '1914-08-13', 'active', 'https://www.redcross.org.au', 'Melbourne', 'VIC', 0.94),

('550e8400-e29b-41d4-a716-446655440042',
 'Fred Hollows Foundation', 'fred-hollows-foundation',
 'foundation', 'health',
 'The Fred Hollows Foundation works to eliminate avoidable blindness by delivering eye health programs and training in developing countries, restoring sight to the most vulnerable.',
 'AU', 'NSW', 'au_acnc', 'ABN 34 068 235 807',
 '1992-01-01', 'active', 'https://www.hollows.org', 'Sydney', 'NSW', 0.93),

('550e8400-e29b-41d4-a716-446655440043',
 'ReachOut Australia', 'reachout-australia',
 'nonprofit', 'health',
 'ReachOut Australia provides digital mental health support and crisis resources for young Australians, helping them get through tough times and achieve better mental health outcomes.',
 'AU', 'NSW', 'au_acnc', 'ABN 41 101 556 413',
 '2000-03-01', 'active', 'https://www.reachout.com', 'Sydney', 'NSW', 0.87),

('550e8400-e29b-41d4-a716-446655440044',
 'Great Barrier Reef Foundation', 'great-barrier-reef-foundation',
 'foundation', 'environment',
 'The Great Barrier Reef Foundation works to protect and restore the Great Barrier Reef through science, partnerships, and community action to tackle climate change and local threats.',
 'AU', 'QLD', 'au_acnc', 'ABN 80 150 728 897',
 '2001-07-01', 'active', 'https://www.barrierreef.org', 'Brisbane', 'QLD', 0.91),

('550e8400-e29b-41d4-a716-446655440045',
 'Indigenous Community Volunteers', 'indigenous-community-volunteers',
 'nonprofit', 'social_services',
 'Indigenous Community Volunteers sends skilled volunteers to work in partnership with Aboriginal and Torres Strait Islander communities on projects that communities identify as priorities.',
 'AU', 'ACT', 'au_acnc', 'ABN 23 057 728 512',
 '1995-11-01', 'active', 'https://www.icv.org.au', 'Canberra', 'ACT', 0.82),

-- ── India (5) ────────────────────────────────────────────────────────────────

('550e8400-e29b-41d4-a716-446655440046',
 'CRY — Child Rights and You', 'cry-child-rights-and-you',
 'ngo', 'education',
 'CRY works to ensure that children''s rights are at the heart of the development agenda in India through direct programs, grantmaking to partner NGOs, and policy advocacy.',
 'IN', 'Maharashtra', 'in_ngo_darpan', 'MH/2009/0014382',
 '1979-07-14', 'active', 'https://www.cry.org', 'Mumbai', 'Maharashtra', 0.88),

('550e8400-e29b-41d4-a716-446655440047',
 'Pratham Education Foundation', 'pratham-education-foundation',
 'foundation', 'education',
 'Pratham is one of India''s largest education NGOs, working every year with millions of children to provide quality education through its innovative learning programs and open-source tools.',
 'IN', 'Maharashtra', 'in_ngo_darpan', 'MH/1994/0004721',
 '1994-01-01', 'active', 'https://www.pratham.org', 'Mumbai', 'Maharashtra', 0.91),

('550e8400-e29b-41d4-a716-446655440048',
 'Goonj', 'goonj',
 'ngo', 'poverty',
 'Goonj transforms urban surplus — cloth, material, and money — into a development resource for under-served rural communities through innovative material banking and dignified aid distribution.',
 'IN', 'Delhi', 'in_ngo_darpan', 'DL/1999/0031806',
 '1999-02-01', 'active', 'https://www.goonj.org', 'New Delhi', 'Delhi', 0.85),

('550e8400-e29b-41d4-a716-446655440049',
 'Naandi Foundation', 'naandi-foundation',
 'foundation', 'health',
 'Naandi Foundation improves the lives of tribal and rural communities across India through integrated programmes in education, nutrition, safe water, and sustainable livelihoods.',
 'IN', 'Telangana', 'in_ngo_darpan', 'TS/2000/0018934',
 '2000-01-01', 'active', 'https://www.naandi.org', 'Hyderabad', 'Telangana', 0.86),

('550e8400-e29b-41d4-a716-446655440050',
 'Sulabh International Social Service Organisation', 'sulabh-international',
 'ngo', 'social_services',
 'Sulabh International works to liberate scavengers, promote sanitation, non-conventional energy, and waste management, and uphold the dignity of the poor through affordable toilets and education.',
 'IN', 'Delhi', 'in_ngo_darpan', 'DL/1970/0002841',
 '1970-01-01', 'active', 'https://www.sulabhinternational.org', 'New Delhi', 'Delhi', 0.80)

ON CONFLICT DO NOTHING;


-- ---------------------------------------------------------------------------
-- PEOPLE (20)
-- ---------------------------------------------------------------------------

INSERT INTO people (id, name, name_normalized, entity_cluster_id) VALUES
('660e8400-e29b-41d4-a716-446655440001', 'Gail McGovern',       'gail mcgovern',       NULL),
('660e8400-e29b-41d4-a716-446655440002', 'Claire Babineaux-Fontenot', 'claire babineaux-fontenot', NULL),
('660e8400-e29b-41d4-a716-446655440003', 'Avril Benoît',        'avril benoit',        NULL),
('660e8400-e29b-41d4-a716-446655440004', 'Mark Suzman',         'mark suzman',         NULL),
('660e8400-e29b-41d4-a716-446655440005', 'Angela Williams',     'angela williams',     NULL),
('660e8400-e29b-41d4-a716-446655440006', 'Jennifer Morris',     'jennifer morris',     NULL),
('660e8400-e29b-41d4-a716-446655440007', 'Jonathan Reckford',   'jonathan reckford',   NULL),
('660e8400-e29b-41d4-a716-446655440008', 'Carter Roberts',      'carter roberts',      NULL),
('660e8400-e29b-41d4-a716-446655440009', 'Janti Soeripto',      'janti soeripto',      NULL),
('660e8400-e29b-41d4-a716-446655440010', 'Michelle Nunn',       'michelle nunn',       NULL),
('660e8400-e29b-41d4-a716-446655440011', 'Danny Sriskandarajah','danny sriskandarajah',NULL),
('660e8400-e29b-41d4-a716-446655440012', 'Hilary McGrady',      'hilary mcgrady',      NULL),
('660e8400-e29b-41d4-a716-446655440013', 'Mark Goldring',       'mark goldring',       NULL),
('660e8400-e29b-41d4-a716-446655440014', 'Michelle Mitchell',   'michelle mitchell',   NULL),
('660e8400-e29b-41d4-a716-446655440015', 'John Aiken',          'john aiken',          NULL),
('660e8400-e29b-41d4-a716-446655440016', 'Conrad Sauvé',        'conrad sauve',        NULL),
('660e8400-e29b-41d4-a716-446655440017', 'Brian Doolan',        'brian doolan',        NULL),
('660e8400-e29b-41d4-a716-446655440018', 'Polly Higgins',       'polly higgins',       NULL),
('660e8400-e29b-41d4-a716-446655440019', 'Rohini Nilekani',     'rohini nilekani',     NULL),
('660e8400-e29b-41d4-a716-446655440020', 'Madhav Chavan',       'madhav chavan',       NULL)
ON CONFLICT DO NOTHING;


-- ---------------------------------------------------------------------------
-- ORGANIZATION_PEOPLE
-- ---------------------------------------------------------------------------

INSERT INTO organization_people (
  id, organization_id, person_id, role, title,
  compensation, currency, start_date, is_current, filing_year
) VALUES
('770e8400-e29b-41d4-a716-446655440001',
 '550e8400-e29b-41d4-a716-446655440001','660e8400-e29b-41d4-a716-446655440001',
 'ceo','President & CEO', 632118,'USD','2008-08-01',true,2023),

('770e8400-e29b-41d4-a716-446655440002',
 '550e8400-e29b-41d4-a716-446655440002','660e8400-e29b-41d4-a716-446655440002',
 'ceo','President & CEO', 561227,'USD','2019-11-01',true,2023),

('770e8400-e29b-41d4-a716-446655440003',
 '550e8400-e29b-41d4-a716-446655440003','660e8400-e29b-41d4-a716-446655440003',
 'ceo','Executive Director', 318490,'USD','2020-01-01',true,2023),

('770e8400-e29b-41d4-a716-446655440004',
 '550e8400-e29b-41d4-a716-446655440004','660e8400-e29b-41d4-a716-446655440004',
 'ceo','CEO', 918200,'USD','2020-02-01',true,2023),

('770e8400-e29b-41d4-a716-446655440005',
 '550e8400-e29b-41d4-a716-446655440005','660e8400-e29b-41d4-a716-446655440005',
 'ceo','President & CEO', 784310,'USD','2020-09-01',true,2023),

('770e8400-e29b-41d4-a716-446655440006',
 '550e8400-e29b-41d4-a716-446655440006','660e8400-e29b-41d4-a716-446655440006',
 'ceo','President & CEO', 441620,'USD','2019-10-01',true,2023),

('770e8400-e29b-41d4-a716-446655440007',
 '550e8400-e29b-41d4-a716-446655440007','660e8400-e29b-41d4-a716-446655440007',
 'ceo','CEO', 411880,'USD','2005-09-01',true,2023),

('770e8400-e29b-41d4-a716-446655440008',
 '550e8400-e29b-41d4-a716-446655440008','660e8400-e29b-41d4-a716-446655440008',
 'ceo','President & CEO', 520940,'USD','2004-09-01',true,2023),

('770e8400-e29b-41d4-a716-446655440009',
 '550e8400-e29b-41d4-a716-446655440009','660e8400-e29b-41d4-a716-446655440009',
 'ceo','President & CEO', 498720,'USD','2020-01-01',true,2023),

('770e8400-e29b-41d4-a716-446655440010',
 '550e8400-e29b-41d4-a716-446655440010','660e8400-e29b-41d4-a716-446655440010',
 'ceo','President & CEO', 470500,'USD','2015-09-01',true,2023),

('770e8400-e29b-41d4-a716-446655440011',
 '550e8400-e29b-41d4-a716-446655440021','660e8400-e29b-41d4-a716-446655440011',
 'ceo','Chief Executive', 212000,'GBP','2019-05-01',true,2023),

('770e8400-e29b-41d4-a716-446655440012',
 '550e8400-e29b-41d4-a716-446655440026','660e8400-e29b-41d4-a716-446655440012',
 'ceo','Director General', 244000,'GBP','2018-06-01',true,2023),

('770e8400-e29b-41d4-a716-446655440013',
 '550e8400-e29b-41d4-a716-446655440021','660e8400-e29b-41d4-a716-446655440013',
 'director','Board Chair', 0,'GBP','2016-01-01',true,2023),

('770e8400-e29b-41d4-a716-446655440014',
 '550e8400-e29b-41d4-a716-446655440024','660e8400-e29b-41d4-a716-446655440014',
 'ceo','Chief Executive', 238000,'GBP','2018-09-01',true,2023),

('770e8400-e29b-41d4-a716-446655440015',
 '550e8400-e29b-41d4-a716-446655440025','660e8400-e29b-41d4-a716-446655440015',
 'ceo','Director', 290000,'GBP','2020-11-01',true,2023),

('770e8400-e29b-41d4-a716-446655440016',
 '550e8400-e29b-41d4-a716-446655440036','660e8400-e29b-41d4-a716-446655440016',
 'ceo','President & CEO', 380000,'CAD','2014-01-01',true,2023),

('770e8400-e29b-41d4-a716-446655440017',
 '550e8400-e29b-41d4-a716-446655440042','660e8400-e29b-41d4-a716-446655440017',
 'ceo','Chief Executive Officer', 310000,'AUD','2018-03-01',true,2023),

('770e8400-e29b-41d4-a716-446655440018',
 '550e8400-e29b-41d4-a716-446655440044','660e8400-e29b-41d4-a716-446655440018',
 'ceo','CEO', 285000,'AUD','2019-07-01',true,2023),

('770e8400-e29b-41d4-a716-446655440019',
 '550e8400-e29b-41d4-a716-446655440047','660e8400-e29b-41d4-a716-446655440019',
 'trustee','Trustee & Co-Founder', 0,'INR','2000-01-01',true,2023),

('770e8400-e29b-41d4-a716-446655440020',
 '550e8400-e29b-41d4-a716-446655440047','660e8400-e29b-41d4-a716-446655440020',
 'ceo','CEO & Co-Founder', 4800000,'INR','1994-01-01',true,2023)

ON CONFLICT DO NOTHING;


-- ---------------------------------------------------------------------------
-- FINANCIAL FILINGS  (3 years × 20 orgs = 60 rows)
-- UUIDs: 880e8400-e29b-41d4-a716-44665544XXYY
--   XX = org seq 01-20, YY = year (21=2021, 22=2022, 23=2023)
-- ---------------------------------------------------------------------------

INSERT INTO financial_filings (
  id, organization_id, fiscal_year, period_start, period_end, filing_type,
  total_revenue, contributions_grants, program_service_revenue,
  investment_income, other_revenue,
  total_expenses, program_expenses, admin_expenses, fundraising_expenses,
  total_assets, total_liabilities, net_assets,
  program_expense_ratio, admin_expense_ratio, fundraising_efficiency,
  working_capital_ratio, currency
) VALUES

-- ── Org 01: American Red Cross ───────────────────────────────────────────────
('880e8400-e29b-41d4-a716-446655440121',
 '550e8400-e29b-41d4-a716-446655440001',
 2021,'2021-07-01','2022-06-30','990',
 2924800000,2602100000,150300000,104200000,68200000,
 2873500000,2510400000,241800000,121300000,
 4284000000,1682000000,2602000000,
 0.874,0.084,0.047,1.55,'USD'),

('880e8400-e29b-41d4-a716-446655440122',
 '550e8400-e29b-41d4-a716-446655440001',
 2022,'2022-07-01','2023-06-30','990',
 3108600000,2791400000,155700000,91300000,70200000,
 3042100000,2658300000,258400000,125400000,
 4510000000,1724000000,2786000000,
 0.874,0.085,0.045,1.62,'USD'),

('880e8400-e29b-41d4-a716-446655440123',
 '550e8400-e29b-41d4-a716-446655440001',
 2023,'2023-07-01','2024-06-30','990',
 3341200000,2998300000,163400000,108100000,71400000,
 3224800000,2822100000,272400000,130300000,
 4712000000,1795000000,2917000000,
 0.875,0.084,0.043,1.63,'USD'),

-- ── Org 02: Feeding America ──────────────────────────────────────────────────
('880e8400-e29b-41d4-a716-446655440221',
 '550e8400-e29b-41d4-a716-446655440002',
 2021,'2021-07-01','2022-06-30','990',
 4238600000,4193200000,18400000,17900000,9100000,
 4204300000,4092000000,67100000,45200000,
 1372000000,510000000,862000000,
 0.974,0.016,0.011,1.69,'USD'),

('880e8400-e29b-41d4-a716-446655440222',
 '550e8400-e29b-41d4-a716-446655440002',
 2022,'2022-07-01','2023-06-30','990',
 4512900000,4464100000,20200000,19100000,9500000,
 4477200000,4360100000,71400000,45700000,
 1521000000,541000000,980000000,
 0.974,0.016,0.010,1.81,'USD'),

('880e8400-e29b-41d4-a716-446655440223',
 '550e8400-e29b-41d4-a716-446655440002',
 2023,'2023-07-01','2024-06-30','990',
 4784100000,4732900000,21500000,20300000,9400000,
 4749300000,4627200000,75600000,46500000,
 1640000000,558000000,1082000000,
 0.974,0.016,0.010,1.94,'USD'),

-- ── Org 03: Doctors Without Borders USA ─────────────────────────────────────
('880e8400-e29b-41d4-a716-446655440321',
 '550e8400-e29b-41d4-a716-446655440003',
 2021,'2021-01-01','2021-12-31','990',
 428700000,419300000,0,7100000,2300000,
 381600000,339000000,28400000,14200000,
 614000000,84000000,530000000,
 0.889,0.074,0.034,7.31,'USD'),

('880e8400-e29b-41d4-a716-446655440322',
 '550e8400-e29b-41d4-a716-446655440003',
 2022,'2022-01-01','2022-12-31','990',
 481200000,471800000,0,6900000,2500000,
 436100000,387400000,31800000,16900000,
 658000000,91000000,567000000,
 0.889,0.073,0.036,7.23,'USD'),

('880e8400-e29b-41d4-a716-446655440323',
 '550e8400-e29b-41d4-a716-446655440003',
 2023,'2023-01-01','2023-12-31','990',
 516900000,506400000,0,7400000,3100000,
 468200000,416000000,33800000,18400000,
 701000000,97000000,604000000,
 0.889,0.072,0.036,7.22,'USD'),

-- ── Org 04: Gates Foundation ─────────────────────────────────────────────────
('880e8400-e29b-41d4-a716-446655440421',
 '550e8400-e29b-41d4-a716-446655440004',
 2021,'2021-01-01','2021-12-31','990-PF',
 6420000000,6310000000,0,110000000,0,
 5938000000,5697000000,178000000,63000000,
 68300000000,2100000000,66200000000,
 0.960,0.030,0.010,31.52,'USD'),

('880e8400-e29b-41d4-a716-446655440422',
 '550e8400-e29b-41d4-a716-446655440004',
 2022,'2022-01-01','2022-12-31','990-PF',
 7284000000,7160000000,0,124000000,0,
 6712000000,6443000000,201000000,68000000,
 71800000000,2340000000,69460000000,
 0.960,0.030,0.009,29.75,'USD'),

('880e8400-e29b-41d4-a716-446655440423',
 '550e8400-e29b-41d4-a716-446655440004',
 2023,'2023-01-01','2023-12-31','990-PF',
 8140000000,8002000000,0,138000000,0,
 7503000000,7200000000,228000000,75000000,
 75200000000,2500000000,72700000000,
 0.960,0.030,0.009,29.08,'USD'),

-- ── Org 05: United Way Worldwide ────────────────────────────────────────────
('880e8400-e29b-41d4-a716-446655440521',
 '550e8400-e29b-41d4-a716-446655440005',
 2021,'2021-07-01','2022-06-30','990',
 182400000,174200000,5100000,2400000,700000,
 175800000,139200000,22600000,14000000,
 398000000,168000000,230000000,
 0.792,0.129,0.080,1.37,'USD'),

('880e8400-e29b-41d4-a716-446655440522',
 '550e8400-e29b-41d4-a716-446655440005',
 2022,'2022-07-01','2023-06-30','990',
 196100000,187400000,5400000,2700000,600000,
 190200000,150800000,24100000,15300000,
 421000000,174000000,247000000,
 0.793,0.127,0.082,1.42,'USD'),

('880e8400-e29b-41d4-a716-446655440523',
 '550e8400-e29b-41d4-a716-446655440005',
 2023,'2023-07-01','2024-06-30','990',
 214700000,205300000,5900000,2800000,700000,
 208100000,165000000,26200000,16900000,
 448000000,181000000,267000000,
 0.793,0.126,0.082,1.48,'USD'),

-- ── Org 06: Nature Conservancy ───────────────────────────────────────────────
('880e8400-e29b-41d4-a716-446655440621',
 '550e8400-e29b-41d4-a716-446655440006',
 2021,'2021-07-01','2022-06-30','990',
 1632000000,939000000,42000000,612000000,39000000,
 1481000000,1268000000,138000000,75000000,
 9810000000,1420000000,8390000000,
 0.856,0.093,0.080,5.89,'USD'),

('880e8400-e29b-41d4-a716-446655440622',
 '550e8400-e29b-41d4-a716-446655440006',
 2022,'2022-07-01','2023-06-30','990',
 1743000000,1012000000,45000000,643000000,43000000,
 1572000000,1344000000,147000000,81000000,
 10420000000,1490000000,8930000000,
 0.855,0.094,0.080,5.99,'USD'),

('880e8400-e29b-41d4-a716-446655440623',
 '550e8400-e29b-41d4-a716-446655440006',
 2023,'2023-07-01','2024-06-30','990',
 1891000000,1098000000,49000000,698000000,46000000,
 1684000000,1440000000,158000000,86000000,
 11030000000,1560000000,9470000000,
 0.855,0.094,0.078,6.06,'USD'),

-- ── Org 07: Habitat for Humanity ─────────────────────────────────────────────
('880e8400-e29b-41d4-a716-446655440721',
 '550e8400-e29b-41d4-a716-446655440007',
 2021,'2021-07-01','2022-06-30','990',
 1948000000,838000000,1031000000,51000000,28000000,
 1814000000,1591000000,141000000,82000000,
 1610000000,611000000,999000000,
 0.877,0.078,0.098,1.63,'USD'),

('880e8400-e29b-41d4-a716-446655440722',
 '550e8400-e29b-41d4-a716-446655440007',
 2022,'2022-07-01','2023-06-30','990',
 2084000000,900000000,1098000000,54000000,32000000,
 1941000000,1702000000,151000000,88000000,
 1718000000,641000000,1077000000,
 0.877,0.078,0.098,1.68,'USD'),

('880e8400-e29b-41d4-a716-446655440723',
 '550e8400-e29b-41d4-a716-446655440007',
 2023,'2023-07-01','2024-06-30','990',
 2217000000,961000000,1166000000,57000000,33000000,
 2072000000,1816000000,162000000,94000000,
 1840000000,671000000,1169000000,
 0.877,0.078,0.098,1.74,'USD'),

-- ── Org 08: World Wildlife Fund ──────────────────────────────────────────────
('880e8400-e29b-41d4-a716-446655440821',
 '550e8400-e29b-41d4-a716-446655440008',
 2021,'2021-07-01','2022-06-30','990',
 348900000,238400000,18200000,72100000,20200000,
 328700000,280200000,30100000,18400000,
 812000000,142000000,670000000,
 0.852,0.092,0.077,4.72,'USD'),

('880e8400-e29b-41d4-a716-446655440822',
 '550e8400-e29b-41d4-a716-446655440008',
 2022,'2022-07-01','2023-06-30','990',
 371400000,252800000,19400000,78400000,20800000,
 350200000,298200000,32100000,19900000,
 864000000,149000000,715000000,
 0.852,0.092,0.079,4.80,'USD'),

('880e8400-e29b-41d4-a716-446655440823',
 '550e8400-e29b-41d4-a716-446655440008',
 2023,'2023-07-01','2024-06-30','990',
 396100000,270300000,20800000,83400000,21600000,
 374100000,318800000,34300000,21000000,
 918000000,157000000,761000000,
 0.852,0.092,0.078,4.84,'USD'),

-- ── Org 09: Save the Children Federation ─────────────────────────────────────
('880e8400-e29b-41d4-a716-446655440921',
 '550e8400-e29b-41d4-a716-446655440009',
 2021,'2021-01-01','2021-12-31','990',
 758600000,740100000,6200000,9100000,3200000,
 712400000,624100000,58600000,29700000,
 963000000,241000000,722000000,
 0.876,0.082,0.040,3.00,'USD'),

('880e8400-e29b-41d4-a716-446655440922',
 '550e8400-e29b-41d4-a716-446655440009',
 2022,'2022-01-01','2022-12-31','990',
 804100000,784800000,6600000,9500000,3200000,
 758200000,664400000,62400000,31400000,
 1028000000,258000000,770000000,
 0.876,0.082,0.040,3.00,'USD'),

('880e8400-e29b-41d4-a716-446655440923',
 '550e8400-e29b-41d4-a716-446655440009',
 2023,'2023-01-01','2023-12-31','990',
 851700000,831600000,7000000,9800000,3300000,
 804900000,705100000,66200000,33600000,
 1098000000,276000000,822000000,
 0.876,0.082,0.040,2.98,'USD'),

-- ── Org 10: CARE USA ─────────────────────────────────────────────────────────
('880e8400-e29b-41d4-a716-446655441021',
 '550e8400-e29b-41d4-a716-446655440010',
 2021,'2021-07-01','2022-06-30','990',
 612700000,598400000,5100000,7200000,2000000,
 591300000,524800000,44100000,22400000,
 754000000,198000000,556000000,
 0.887,0.075,0.037,2.81,'USD'),

('880e8400-e29b-41d4-a716-446655441022',
 '550e8400-e29b-41d4-a716-446655440010',
 2022,'2022-07-01','2023-06-30','990',
 648900000,634200000,5400000,7100000,2200000,
 626800000,556400000,46800000,23600000,
 803000000,209000000,594000000,
 0.888,0.075,0.037,2.84,'USD'),

('880e8400-e29b-41d4-a716-446655441023',
 '550e8400-e29b-41d4-a716-446655440010',
 2023,'2023-07-01','2024-06-30','990',
 681400000,665900000,5700000,7400000,2400000,
 658100000,584600000,49100000,24400000,
 854000000,221000000,633000000,
 0.888,0.075,0.037,2.86,'USD'),

-- ── Org 11: Sunrise Education Fund ──────────────────────────────────────────
('880e8400-e29b-41d4-a716-446655441121',
 '550e8400-e29b-41d4-a716-446655440011',
 2021,'2021-01-01','2021-12-31','990',
 8420000,7890000,0,380000,150000,
 7940000,6740000,820000,380000,
 14100000,1200000,12900000,
 0.849,0.103,0.048,10.75,'USD'),

('880e8400-e29b-41d4-a716-446655441122',
 '550e8400-e29b-41d4-a716-446655440011',
 2022,'2022-01-01','2022-12-31','990',
 9810000,9200000,0,420000,190000,
 9180000,7800000,940000,440000,
 16200000,1380000,14820000,
 0.850,0.102,0.048,10.74,'USD'),

('880e8400-e29b-41d4-a716-446655441123',
 '550e8400-e29b-41d4-a716-446655440011',
 2023,'2023-01-01','2023-12-31','990',
 11400000,10700000,0,460000,240000,
 10600000,9010000,1080000,510000,
 18900000,1540000,17360000,
 0.850,0.102,0.048,11.27,'USD'),

-- ── Org 12: Great Lakes Environmental Alliance ───────────────────────────────
('880e8400-e29b-41d4-a716-446655441221',
 '550e8400-e29b-41d4-a716-446655440012',
 2021,'2021-01-01','2021-12-31','990',
 4180000,3940000,90000,110000,40000,
 3920000,3350000,380000,190000,
 6840000,480000,6360000,
 0.855,0.097,0.048,13.25,'USD'),

('880e8400-e29b-41d4-a716-446655441222',
 '550e8400-e29b-41d4-a716-446655440012',
 2022,'2022-01-01','2022-12-31','990',
 4640000,4380000,100000,120000,40000,
 4380000,3750000,420000,210000,
 7510000,520000,6990000,
 0.856,0.096,0.048,13.44,'USD'),

('880e8400-e29b-41d4-a716-446655441223',
 '550e8400-e29b-41d4-a716-446655440012',
 2023,'2023-01-01','2023-12-31','990',
 5210000,4920000,110000,130000,50000,
 4920000,4220000,470000,230000,
 8290000,560000,7730000,
 0.858,0.096,0.047,13.73,'USD'),

-- ── Org 13: Pacific Arts Collective ─────────────────────────────────────────
('880e8400-e29b-41d4-a716-446655441321',
 '550e8400-e29b-41d4-a716-446655440013',
 2021,'2021-01-01','2021-12-31','990',
 2140000,1680000,380000,50000,30000,
 2080000,1680000,280000,120000,
 3120000,410000,2710000,
 0.808,0.135,0.071,6.61,'USD'),

('880e8400-e29b-41d4-a716-446655441322',
 '550e8400-e29b-41d4-a716-446655440013',
 2022,'2022-01-01','2022-12-31','990',
 2390000,1870000,420000,60000,40000,
 2330000,1880000,310000,140000,
 3450000,440000,3010000,
 0.807,0.133,0.075,6.84,'USD'),

('880e8400-e29b-41d4-a716-446655441323',
 '550e8400-e29b-41d4-a716-446655440013',
 2023,'2023-01-01','2023-12-31','990',
 2680000,2100000,470000,70000,40000,
 2620000,2120000,340000,160000,
 3810000,470000,3340000,
 0.809,0.130,0.076,7.11,'USD'),

-- ── Org 14: Appalachian Health Initiative ────────────────────────────────────
('880e8400-e29b-41d4-a716-446655441421',
 '550e8400-e29b-41d4-a716-446655440014',
 2021,'2021-01-01','2021-12-31','990',
 3840000,3620000,170000,30000,20000,
 3710000,3090000,490000,130000,
 5120000,680000,4440000,
 0.833,0.132,0.036,6.53,'USD'),

('880e8400-e29b-41d4-a716-446655441422',
 '550e8400-e29b-41d4-a716-446655440014',
 2022,'2022-01-01','2022-12-31','990',
 4120000,3880000,180000,40000,20000,
 3990000,3320000,530000,140000,
 5640000,730000,4910000,
 0.832,0.133,0.036,6.73,'USD'),

('880e8400-e29b-41d4-a716-446655441423',
 '550e8400-e29b-41d4-a716-446655440014',
 2023,'2023-01-01','2023-12-31','990',
 4510000,4250000,200000,40000,20000,
 4380000,3640000,590000,150000,
 6240000,790000,5450000,
 0.831,0.135,0.035,6.90,'USD'),

-- ── Org 15: Clearwater Veterans Support ──────────────────────────────────────
('880e8400-e29b-41d4-a716-446655441521',
 '550e8400-e29b-41d4-a716-446655440015',
 2021,'2021-01-01','2021-12-31','990',
 1920000,1810000,60000,30000,20000,
 1850000,1500000,240000,110000,
 2940000,360000,2580000,
 0.811,0.130,0.061,7.17,'USD'),

('880e8400-e29b-41d4-a716-446655441522',
 '550e8400-e29b-41d4-a716-446655440015',
 2022,'2022-01-01','2022-12-31','990',
 2180000,2060000,70000,30000,20000,
 2110000,1710000,270000,130000,
 3240000,390000,2850000,
 0.811,0.128,0.063,7.31,'USD'),

('880e8400-e29b-41d4-a716-446655441523',
 '550e8400-e29b-41d4-a716-446655440015',
 2023,'2023-01-01','2023-12-31','990',
 2410000,2280000,80000,30000,20000,
 2340000,1900000,300000,140000,
 3620000,420000,3200000,
 0.812,0.128,0.061,7.62,'USD'),

-- ── Org 16: Midwest Food Bank ────────────────────────────────────────────────
('880e8400-e29b-41d4-a716-446655441621',
 '550e8400-e29b-41d4-a716-446655440016',
 2021,'2021-01-01','2021-12-31','990',
 47200000,46800000,100000,200000,100000,
 45900000,44400000,1100000,400000,
 38100000,3200000,34900000,
 0.967,0.024,0.009,10.91,'USD'),

('880e8400-e29b-41d4-a716-446655441622',
 '550e8400-e29b-41d4-a716-446655440016',
 2022,'2022-01-01','2022-12-31','990',
 52100000,51600000,120000,240000,140000,
 50800000,49200000,1200000,400000,
 41800000,3500000,38300000,
 0.969,0.024,0.008,10.94,'USD'),

('880e8400-e29b-41d4-a716-446655441623',
 '550e8400-e29b-41d4-a716-446655440016',
 2023,'2023-01-01','2023-12-31','990',
 57800000,57200000,140000,260000,200000,
 56400000,54700000,1300000,400000,
 45900000,3800000,42100000,
 0.970,0.023,0.007,11.08,'USD'),

-- ── Org 17: Digital Equity Foundation ───────────────────────────────────────
('880e8400-e29b-41d4-a716-446655441721',
 '550e8400-e29b-41d4-a716-446655440017',
 2021,'2021-01-01','2021-12-31','990',
 6840000,6490000,110000,180000,60000,
 6620000,5620000,710000,290000,
 9480000,820000,8660000,
 0.849,0.107,0.045,10.56,'USD'),

('880e8400-e29b-41d4-a716-446655441722',
 '550e8400-e29b-41d4-a716-446655440017',
 2022,'2022-01-01','2022-12-31','990',
 8940000,8490000,140000,240000,70000,
 8610000,7310000,920000,380000,
 12400000,1020000,11380000,
 0.849,0.107,0.045,11.16,'USD'),

('880e8400-e29b-41d4-a716-446655441723',
 '550e8400-e29b-41d4-a716-446655440017',
 2023,'2023-01-01','2023-12-31','990',
 12100000,11500000,190000,310000,100000,
 11680000,9920000,1240000,520000,
 16800000,1310000,15490000,
 0.849,0.106,0.045,11.82,'USD'),

-- ── Org 18: Border Community Health Services ─────────────────────────────────
('880e8400-e29b-41d4-a716-446655441821',
 '550e8400-e29b-41d4-a716-446655440018',
 2021,'2021-01-01','2021-12-31','990',
 5120000,4280000,780000,40000,20000,
 4980000,4190000,580000,210000,
 7140000,980000,6160000,
 0.841,0.117,0.049,6.29,'USD'),

('880e8400-e29b-41d4-a716-446655441822',
 '550e8400-e29b-41d4-a716-446655440018',
 2022,'2022-01-01','2022-12-31','990',
 5490000,4590000,840000,40000,20000,
 5340000,4490000,630000,220000,
 7820000,1040000,6780000,
 0.841,0.118,0.048,6.52,'USD'),

('880e8400-e29b-41d4-a716-446655441823',
 '550e8400-e29b-41d4-a716-446655440018',
 2023,'2023-01-01','2023-12-31','990',
 5940000,4970000,900000,50000,20000,
 5770000,4850000,690000,230000,
 8590000,1100000,7490000,
 0.841,0.120,0.046,6.81,'USD'),

-- ── Org 19: Heritage Conservation Trust (inactive) ──────────────────────────
('880e8400-e29b-41d4-a716-446655441921',
 '550e8400-e29b-41d4-a716-446655440019',
 2021,'2021-01-01','2021-12-31','990',
 840000,760000,40000,30000,10000,
 910000,730000,140000,40000,
 1840000,520000,1320000,
 0.802,0.154,0.053,2.54,'USD'),

('880e8400-e29b-41d4-a716-446655441922',
 '550e8400-e29b-41d4-a716-446655440019',
 2022,'2022-01-01','2022-12-31','990',
 620000,540000,30000,40000,10000,
 780000,600000,140000,40000,
 1490000,540000,950000,
 0.769,0.179,0.074,1.76,'USD'),

('880e8400-e29b-41d4-a716-446655441923',
 '550e8400-e29b-41d4-a716-446655440019',
 2023,'2023-01-01','2023-12-31','990',
 310000,270000,10000,20000,10000,
 490000,360000,100000,30000,
 1120000,560000,560000,
 0.735,0.204,0.111,1.00,'USD'),

-- ── Org 20: Gulf Coast Disaster Relief Fund ──────────────────────────────────
('880e8400-e29b-41d4-a716-446655442021',
 '550e8400-e29b-41d4-a716-446655440020',
 2021,'2021-01-01','2021-12-31','990',
 18400000,17800000,0,400000,200000,
 16900000,14800000,1400000,700000,
 24100000,2800000,21300000,
 0.876,0.083,0.039,7.61,'USD'),

('880e8400-e29b-41d4-a716-446655442022',
 '550e8400-e29b-41d4-a716-446655440020',
 2022,'2022-01-01','2022-12-31','990',
 21600000,20900000,0,470000,230000,
 19800000,17300000,1600000,900000,
 27800000,3100000,24700000,
 0.874,0.081,0.043,7.97,'USD'),

('880e8400-e29b-41d4-a716-446655442023',
 '550e8400-e29b-41d4-a716-446655440020',
 2023,'2023-01-01','2023-12-31','990',
 28900000,28100000,0,540000,260000,
 26400000,23100000,2100000,1200000,
 33400000,3500000,29900000,
 0.875,0.080,0.043,8.54,'USD')

ON CONFLICT DO NOTHING;


-- ---------------------------------------------------------------------------
-- GRANTS (35 grants — mix of domestic and cross-border)
-- ---------------------------------------------------------------------------

INSERT INTO grants (
  id, funder_org_id, recipient_org_id,
  amount, currency, amount_usd,
  grant_date, fiscal_year, purpose, program_area, grant_type,
  source, source_id
) VALUES

-- Gates Foundation → various (large cross-border grants)
('990e8400-e29b-41d4-a716-446655440001',
 '550e8400-e29b-41d4-a716-446655440004','550e8400-e29b-41d4-a716-446655440003',
 45000000,'USD',45000000,
 '2023-03-15',2023,'Emergency medical operations in East Africa and Ukraine',
 'health','project','irs_990_schedule_i','GATES-2023-001'),

('990e8400-e29b-41d4-a716-446655440002',
 '550e8400-e29b-41d4-a716-446655440004','550e8400-e29b-41d4-a716-446655440047',
 12000000,'USD',12000000,
 '2023-06-01',2023,'Expanding foundational literacy programme across five Indian states',
 'education','project','irs_990_schedule_i','GATES-2023-002'),

('990e8400-e29b-41d4-a716-446655440003',
 '550e8400-e29b-41d4-a716-446655440004','550e8400-e29b-41d4-a716-446655440049',
 8500000,'USD',8500000,
 '2022-11-10',2022,'Integrated nutrition and safe water programme in tribal Telangana',
 'health','project','irs_990_schedule_i','GATES-2022-001'),

('990e8400-e29b-41d4-a716-446655440004',
 '550e8400-e29b-41d4-a716-446655440004','550e8400-e29b-41d4-a716-446655440042',
 18000000,'USD',18000000,
 '2022-04-20',2022,'Cataract surgery training and equipment for Pacific Island nations',
 'health','project','irs_990_schedule_i','GATES-2022-002'),

('990e8400-e29b-41d4-a716-446655440005',
 '550e8400-e29b-41d4-a716-446655440004','550e8400-e29b-41d4-a716-446655440009',
 30000000,'USD',30000000,
 '2021-09-01',2021,'Child nutrition and early education in Yemen and Somalia',
 'education','project','irs_990_schedule_i','GATES-2021-001'),

-- Wellcome Trust → global health
('990e8400-e29b-41d4-a716-446655440006',
 '550e8400-e29b-41d4-a716-446655440025','550e8400-e29b-41d4-a716-446655440024',
 22000000,'GBP',27720000,
 '2023-02-01',2023,'Joint funding for cancer genomics research consortium',
 'health','project','360giving','WELLCOME-2023-001'),

('990e8400-e29b-41d4-a716-446655440007',
 '550e8400-e29b-41d4-a716-446655440025','550e8400-e29b-41d4-a716-446655440030',
 4800000,'GBP',6048000,
 '2022-07-15',2022,'Mental health innovation fund — digital therapy platforms',
 'health','general_support','360giving','WELLCOME-2022-001'),

('990e8400-e29b-41d4-a716-446655440008',
 '550e8400-e29b-41d4-a716-446655440025','550e8400-e29b-41d4-a716-446655440048',
 3200000,'GBP',4032000,
 '2022-09-20',2022,'Community health worker network in rural Rajasthan',
 'health','project','360giving','WELLCOME-2022-002'),

-- Nature Conservancy → environment
('990e8400-e29b-41d4-a716-446655440009',
 '550e8400-e29b-41d4-a716-446655440006','550e8400-e29b-41d4-a716-446655440012',
 2400000,'USD',2400000,
 '2023-04-01',2023,'Great Lakes habitat restoration — watershed monitoring grants',
 'environment','project','irs_990_schedule_i','TNC-2023-001'),

('990e8400-e29b-41d4-a716-446655440010',
 '550e8400-e29b-41d4-a716-446655440006','550e8400-e29b-41d4-a716-446655440029',
 1800000,'USD',1800000,
 '2022-10-12',2022,'North Sea marine conservation coordination grant',
 'environment','project','irs_990_schedule_i','TNC-2022-001'),

('990e8400-e29b-41d4-a716-446655440011',
 '550e8400-e29b-41d4-a716-446655440006','550e8400-e29b-41d4-a716-446655440044',
 5000000,'USD',5000000,
 '2023-01-18',2023,'Great Barrier Reef resilience fund — coral restoration science',
 'environment','project','irs_990_schedule_i','TNC-2023-002'),

('990e8400-e29b-41d4-a716-446655440012',
 '550e8400-e29b-41d4-a716-446655440006','550e8400-e29b-41d4-a716-446655440039',
 3100000,'USD',3100000,
 '2021-11-05',2021,'Boreal old-growth mapping and protection in Alberta',
 'environment','project','irs_990_schedule_i','TNC-2021-001'),

-- US foundations → Canadian / domestic
('990e8400-e29b-41d4-a716-446655440013',
 '550e8400-e29b-41d4-a716-446655440004','550e8400-e29b-41d4-a716-446655440040',
 6200000,'USD',6200000,
 '2023-05-22',2023,'First Nations literacy and numeracy programme — three provinces',
 'education','project','irs_990_schedule_i','GATES-2023-003'),

('990e8400-e29b-41d4-a716-446655440014',
 '550e8400-e29b-41d4-a716-446655440011','550e8400-e29b-41d4-a716-446655440014',
 480000,'USD',480000,
 '2023-03-01',2023,'Rural Appalachian health navigator training program',
 'health','project','irs_990_schedule_i','SUNRISE-2023-001'),

('990e8400-e29b-41d4-a716-446655440015',
 '550e8400-e29b-41d4-a716-446655440011','550e8400-e29b-41d4-a716-446655440018',
 320000,'USD',320000,
 '2022-08-15',2022,'Bilingual health literacy curriculum development',
 'health','project','irs_990_schedule_i','SUNRISE-2022-001'),

-- Red Cross cross-border
('990e8400-e29b-41d4-a716-446655440016',
 '550e8400-e29b-41d4-a716-446655440001','550e8400-e29b-41d4-a716-446655440036',
 8000000,'USD',8000000,
 '2023-02-20',2023,'Canada flood response coordination and shelter assistance',
 'disaster_relief','general_support','irs_990_schedule_i','ARC-2023-001'),

('990e8400-e29b-41d4-a716-446655440017',
 '550e8400-e29b-41d4-a716-446655440001','550e8400-e29b-41d4-a716-446655440041',
 6500000,'USD',6500000,
 '2022-03-10',2022,'Australian flood disaster — Queensland and NSW emergency relief',
 'disaster_relief','general_support','irs_990_schedule_i','ARC-2022-001'),

('990e8400-e29b-41d4-a716-446655440018',
 '550e8400-e29b-41d4-a716-446655440022','550e8400-e29b-41d4-a716-446655440001',
 5200000,'GBP',6552000,
 '2023-07-01',2023,'Joint hurricane preparedness programme — Caribbean and Gulf Coast',
 'disaster_relief','project','360giving','BRC-2023-001'),

-- Oxfam → poverty
('990e8400-e29b-41d4-a716-446655440019',
 '550e8400-e29b-41d4-a716-446655440021','550e8400-e29b-41d4-a716-446655440010',
 4100000,'GBP',5166000,
 '2023-04-05',2023,'Horn of Africa food security and resilience livelihoods programme',
 'poverty','project','360giving','OXFAM-2023-001'),

('990e8400-e29b-41d4-a716-446655440020',
 '550e8400-e29b-41d4-a716-446655440021','550e8400-e29b-41d4-a716-446655440048',
 2800000,'GBP',3528000,
 '2022-10-01',2022,'Urban livelihoods and waste-to-value programme — Delhi NCR',
 'poverty','project','360giving','OXFAM-2022-001'),

-- Save the Children cross-border
('990e8400-e29b-41d4-a716-446655440021',
 '550e8400-e29b-41d4-a716-446655440023','550e8400-e29b-41d4-a716-446655440009',
 9800000,'GBP',12348000,
 '2023-01-10',2023,'Joint emergency education in conflict zones — Sudan and Sahel',
 'education','project','360giving','SCUK-2023-001'),

('990e8400-e29b-41d4-a716-446655440022',
 '550e8400-e29b-41d4-a716-446655440009','550e8400-e29b-41d4-a716-446655440046',
 3400000,'USD',3400000,
 '2022-06-15',2022,'Child rights monitoring network — six Indian states',
 'education','project','irs_990_schedule_i','SC-2022-001'),

-- Aga Khan → South Asia
('990e8400-e29b-41d4-a716-446655440023',
 '550e8400-e29b-41d4-a716-446655440037','550e8400-e29b-41d4-a716-446655440049',
 4600000,'CAD',3404000,
 '2023-03-28',2023,'Rural water and sanitation programme — Madhya Pradesh',
 'health','project','iati','AKFC-2023-001'),

('990e8400-e29b-41d4-a716-446655440024',
 '550e8400-e29b-41d4-a716-446655440037','550e8400-e29b-41d4-a716-446655440040',
 2200000,'CAD',1628000,
 '2022-11-01',2022,'Indigenous post-secondary bursary fund — Manitoba and Saskatchewan',
 'education','endowment','iati','AKFC-2022-001'),

-- Domestic smaller grants
('990e8400-e29b-41d4-a716-446655440025',
 '550e8400-e29b-41d4-a716-446655440020','550e8400-e29b-41d4-a716-446655440016',
 890000,'USD',890000,
 '2023-09-05',2023,'Post-storm food distribution — Louisiana parishes',
 'disaster_relief','general_support','irs_990_schedule_i','GCDR-2023-001'),

('990e8400-e29b-41d4-a716-446655440026',
 '550e8400-e29b-41d4-a716-446655440020','550e8400-e29b-41d4-a716-446655440015',
 420000,'USD',420000,
 '2022-10-18',2022,'Emergency veteran housing after Hurricane Ian — Lee County',
 'disaster_relief','general_support','irs_990_schedule_i','GCDR-2022-001'),

('990e8400-e29b-41d4-a716-446655440027',
 '550e8400-e29b-41d4-a716-446655440017','550e8400-e29b-41d4-a716-446655440013',
 360000,'USD',360000,
 '2023-07-10',2023,'Digital access grants for arts education in Title I schools',
 'education','project','irs_990_schedule_i','DEF-2023-001'),

-- Fred Hollows → Australia domestic + India
('990e8400-e29b-41d4-a716-446655440028',
 '550e8400-e29b-41d4-a716-446655440042','550e8400-e29b-41d4-a716-446655440045',
 920000,'AUD',614000,
 '2023-05-01',2023,'Remote Aboriginal community eye health outreach — Northern Territory',
 'health','project','au_acnc_grants','FHF-2023-001'),

('990e8400-e29b-41d4-a716-446655440029',
 '550e8400-e29b-41d4-a716-446655440042','550e8400-e29b-41d4-a716-446655440049',
 2100000,'AUD',1401000,
 '2022-08-30',2022,'Eye care training programme for Naandi rural health workers',
 'health','project','au_acnc_grants','FHF-2022-001'),

-- WWF UK → environment
('990e8400-e29b-41d4-a716-446655440030',
 '550e8400-e29b-41d4-a716-446655440032','550e8400-e29b-41d4-a716-446655440044',
 1400000,'GBP',1764000,
 '2023-06-20',2023,'Indo-Pacific coral reef monitoring and climate adaptation',
 'environment','project','360giving','WWFUK-2023-001'),

('990e8400-e29b-41d4-a716-446655440031',
 '550e8400-e29b-41d4-a716-446655440032','550e8400-e29b-41d4-a716-446655440039',
 2600000,'GBP',3276000,
 '2022-12-01',2022,'Boreal-Atlantic migratory species corridor research',
 'environment','project','360giving','WWFUK-2022-001'),

-- ReachOut → mental health coordination
('990e8400-e29b-41d4-a716-446655440032',
 '550e8400-e29b-41d4-a716-446655440043','550e8400-e29b-41d4-a716-446655440027',
 480000,'AUD',320000,
 '2023-08-14',2023,'Youth digital mental health shared-platform development',
 'health','project','au_acnc_grants','RA-2023-001'),

-- Domestic arts & education
('990e8400-e29b-41d4-a716-446655440033',
 '550e8400-e29b-41d4-a716-446655440026','550e8400-e29b-41d4-a716-446655440033',
 680000,'GBP',856800,
 '2023-04-28',2023,'Heritage skills and traditional craft apprenticeship programme',
 'arts','project','360giving','NT-2023-001'),

('990e8400-e29b-41d4-a716-446655440034',
 '550e8400-e29b-41d4-a716-446655440034','550e8400-e29b-41d4-a716-446655440035',
 290000,'GBP',365400,
 '2022-03-15',2022,'Rural community learning hubs — Welsh valley communities',
 'education','general_support','360giving','SREF-2022-001'),

('990e8400-e29b-41d4-a716-446655440035',
 '550e8400-e29b-41d4-a716-446655440005','550e8400-e29b-41d4-a716-446655440011',
 750000,'USD',750000,
 '2021-07-01',2021,'Southern US college access and workforce readiness grants',
 'education','project','irs_990_schedule_i','UWW-2021-001')

ON CONFLICT DO NOTHING;


-- ---------------------------------------------------------------------------
-- ANOMALY ALERTS (10)
-- ---------------------------------------------------------------------------

INSERT INTO anomaly_alerts (
  id, organization_id, fiscal_year,
  alert_type, severity, confidence,
  title, description, evidence, methodology,
  is_reviewed
) VALUES

('aa0e8400-e29b-41d4-a716-446655440001',
 '550e8400-e29b-41d4-a716-446655440019', 2022,
 'revenue_expense_mismatch', 'high', 0.91,
 'Expenses exceeded revenue by 26% — potential insolvency signal',
 'Heritage Conservation Trust reported expenses of $780,000 against revenue of only $620,000 in FY2022, a deficit of $160,000 (26%). Combined with a 43% year-over-year revenue decline, this pattern suggests possible organisational distress.',
 '{"revenue_2021": 840000, "revenue_2022": 620000, "expenses_2022": 780000, "deficit": 160000, "revenue_decline_pct": 26.2, "prior_year_surplus": false}',
 'ratio_threshold_v1', false),

('aa0e8400-e29b-41d4-a716-446655440002',
 '550e8400-e29b-41d4-a716-446655440019', 2023,
 'rapid_growth', 'medium', 0.78,
 'Fundraising efficiency deteriorated sharply — expenses rising while revenue collapses',
 'FY2023 shows fundraising expenses ($30,000) consuming 11.1% of drastically reduced contributions ($270,000). Program expense ratio fell below 0.74, approaching the threshold for regulatory scrutiny.',
 '{"fundraising_efficiency_2023": 0.111, "program_ratio_2023": 0.735, "contributions_yoy_change": -0.50, "status": "inactive"}',
 'ratio_threshold_v1', true),

('aa0e8400-e29b-41d4-a716-446655440003',
 '550e8400-e29b-41d4-a716-446655440013', 2022,
 'overhead_manipulation', 'medium', 0.72,
 'Admin expense ratio elevated above sector peer median',
 'Pacific Arts Collective''s admin expense ratio of 13.3% is 2.1× the arts sector median of 6.4%. While not unusual for small arts organizations, the ratio has been consistently above peers across all three observed years.',
 '{"admin_ratio_org": 0.133, "sector_median": 0.064, "peer_count": 142, "percentile": 87}',
 'peer_comparison_v1', false),

('aa0e8400-e29b-41d4-a716-446655440004',
 '550e8400-e29b-41d4-a716-446655440017', 2023,
 'rapid_growth', 'medium', 0.84,
 'Revenue grew 35% YoY — rapid growth warrants enhanced due diligence',
 'Digital Equity Foundation reported $12.1M in revenue in FY2023, a 35% increase from $8.94M in FY2022. While aligned with mission expansion, rapid growth of this magnitude increases operational and governance risk.',
 '{"revenue_2022": 8940000, "revenue_2023": 12100000, "growth_pct": 35.3, "asset_growth_pct": 35.5, "staff_disclosure": "partial"}',
 'growth_detector_v1', false),

('aa0e8400-e29b-41d4-a716-446655440005',
 '550e8400-e29b-41d4-a716-446655440018', 2023,
 'compensation_outlier', 'low', 0.62,
 'No compensation disclosure found for executive leadership',
 'Border Community Health Services FY2023 filing lacks individual compensation disclosures for its executive director and two senior officers, despite crossing the $50,000 per-officer reporting threshold under IRS Form 990 Part VII.',
 '{"filing_type": "990", "revenue": 5940000, "threshold_usd": 50000, "disclosed_officers": 0, "expected_officers": 3}',
 'disclosure_completeness_v1', false),

('aa0e8400-e29b-41d4-a716-446655440006',
 '550e8400-e29b-41d4-a716-446655440035', 2022,
 'filing_inconsistency', 'high', 0.88,
 'Charity Commission filing shows unreconciled £189,000 discrepancy',
 'Wales Community Rebuild Fund''s 2022 Charity Commission annual return reports total income of £411,000, which cannot be reconciled with the independently filed accounts showing £600,000. The £189,000 gap (46%) exceeds the materiality threshold.',
 '{"annual_return_income": 411000, "filed_accounts_income": 600000, "discrepancy_gbp": 189000, "discrepancy_pct": 45.9, "currency": "GBP"}',
 'cross_source_reconciliation_v1', false),

('aa0e8400-e29b-41d4-a716-446655440007',
 '550e8400-e29b-41d4-a716-446655440015', 2022,
 'zero_fundraising', 'low', 0.69,
 'Fundraising expenses imply implausibly low cost-per-donor',
 'Clearwater Veterans Support Network reported only $130,000 in fundraising expenses while raising $2.06M in contributions — a fundraising efficiency ratio of 6.3%. Whilst efficient, this is anomalously low for an organisation of its size and may indicate misclassification of fundraising costs as program expenses.',
 '{"fundraising_expenses": 130000, "contributions": 2060000, "efficiency": 0.063, "sector_p25": 0.12, "sector_p10": 0.09}',
 'peer_comparison_v1', false),

('aa0e8400-e29b-41d4-a716-446655440008',
 '550e8400-e29b-41d4-a716-446655440050', 2022,
 'network_anomaly', 'medium', 0.76,
 'Director network overlap with three private construction vendors',
 'Sulabh International''s board includes two individuals who serve as directors of private sanitation construction companies that hold supply contracts with the organisation. This related-party network pattern warrants disclosure review.',
 '{"overlapping_directors": 2, "related_vendors": 3, "contract_value_inr": 48000000, "disclosure_status": "not_found"}',
 'network_analysis_v1', true),

('aa0e8400-e29b-41d4-a716-446655440009',
 '550e8400-e29b-41d4-a716-446655440004', 2022,
 'benford_violation', 'low', 0.58,
 'Benford''s Law deviation in Schedule I grant amounts — first-digit analysis',
 'Analysis of 847 Schedule I grant amounts for the Gates Foundation FY2022 filing shows a statistically significant excess of entries beginning with digit "1" (observed 36.2%, expected 30.1%) and deficit of entries beginning with "8" (observed 2.8%, expected 5.1%). Chi-squared p-value = 0.041.',
 '{"grant_count": 847, "chi_squared": 14.82, "p_value": 0.041, "digit_1_observed": 0.362, "digit_1_expected": 0.301, "digit_8_observed": 0.028, "digit_8_expected": 0.051}',
 'benford_analysis_v1', false),

('aa0e8400-e29b-41d4-a716-446655440010',
 '550e8400-e29b-41d4-a716-446655440011', 2023,
 'geographic_discrepancy', 'medium', 0.81,
 'Program spend concentrated outside stated service geography',
 'Sunrise Education Fund''s stated mission targets the American South, but FY2023 program expenditure analysis shows 38% of grant disbursements flowing to organisations headquartered outside the South, including three in the Pacific Northwest. This geographic mismatch may reflect mission drift.',
 '{"mission_region": "American South", "pct_outside_region": 0.38, "outside_grant_count": 7, "outside_grant_value_usd": 3420000, "filing_year": 2023}',
 'geographic_analysis_v1', false)

ON CONFLICT DO NOTHING;


-- ---------------------------------------------------------------------------
-- ORGANIZATION_SCORES (FY2023 for first 20 orgs)
-- ---------------------------------------------------------------------------

INSERT INTO organization_scores (
  id, organization_id, fiscal_year,
  overall_score, financial_health_score, transparency_score,
  governance_score, efficiency_score,
  score_breakdown, methodology_version
) VALUES
('bb0e8400-e29b-41d4-a716-446655440001','550e8400-e29b-41d4-a716-446655440001',2023, 87,85,92,88,84,'{"rationale":"Strong program ratio, high transparency, mature governance"}','v1'),
('bb0e8400-e29b-41d4-a716-446655440002','550e8400-e29b-41d4-a716-446655440002',2023, 94,96,93,91,97,'{"rationale":"Exceptional program ratio 97.4%, low overhead, strong reserves"}','v1'),
('bb0e8400-e29b-41d4-a716-446655440003','550e8400-e29b-41d4-a716-446655440003',2023, 91,89,94,90,88,'{"rationale":"High efficiency, full financial disclosure, broad donor base"}','v1'),
('bb0e8400-e29b-41d4-a716-446655440004','550e8400-e29b-41d4-a716-446655440004',2023, 96,98,97,95,96,'{"rationale":"Largest private foundation globally, near-perfect program ratio, exemplary governance"}','v1'),
('bb0e8400-e29b-41d4-a716-446655440005','550e8400-e29b-41d4-a716-446655440005',2023, 79,77,84,80,76,'{"rationale":"Federated model compresses program ratio; improving transparency"}','v1'),
('bb0e8400-e29b-41d4-a716-446655440006','550e8400-e29b-41d4-a716-446655440006',2023, 88,90,87,89,86,'{"rationale":"High investment income diversification; strong conservation outcomes"}','v1'),
('bb0e8400-e29b-41d4-a716-446655440007','550e8400-e29b-41d4-a716-446655440007',2023, 85,83,88,86,82,'{"rationale":"Program services revenue supplements donations; strong volunteer leverage"}','v1'),
('bb0e8400-e29b-41d4-a716-446655440008','550e8400-e29b-41d4-a716-446655440008',2023, 86,88,85,87,84,'{"rationale":"Investment income reliance noted; conservation outcomes well documented"}','v1'),
('bb0e8400-e29b-41d4-a716-446655440009','550e8400-e29b-41d4-a716-446655440009',2023, 89,87,91,90,88,'{"rationale":"High program ratio, strong reserves, full disclosure"}','v1'),
('bb0e8400-e29b-41d4-a716-446655440010','550e8400-e29b-41d4-a716-446655440010',2023, 88,86,90,88,87,'{"rationale":"Gender-lens programming premium; efficient cost structure"}','v1'),
('bb0e8400-e29b-41d4-a716-446655440011','550e8400-e29b-41d4-a716-446655440011',2023, 76,74,79,75,78,'{"rationale":"Geographic mission drift flagged; good financial health for size"}','v1'),
('bb0e8400-e29b-41d4-a716-446655440012','550e8400-e29b-41d4-a716-446655440012',2023, 82,84,80,81,83,'{"rationale":"Excellent working capital ratio; small org transparency gap"}','v1'),
('bb0e8400-e29b-41d4-a716-446655440013','550e8400-e29b-41d4-a716-446655440013',2023, 72,70,74,73,68,'{"rationale":"Elevated admin ratio; small arts sector context noted"}','v1'),
('bb0e8400-e29b-41d4-a716-446655440014','550e8400-e29b-41d4-a716-446655440014',2023, 78,76,78,77,80,'{"rationale":"Strong rural health impact; compensation disclosure incomplete"}','v1'),
('bb0e8400-e29b-41d4-a716-446655440015','550e8400-e29b-41d4-a716-446655440015',2023, 74,72,76,73,75,'{"rationale":"Possible fundraising cost misclassification; solid reserves"}','v1'),
('bb0e8400-e29b-41d4-a716-446655440016','550e8400-e29b-41d4-a716-446655440016',2023, 92,94,90,91,96,'{"rationale":"Near-perfect program ratio; food bank model drives efficiency"}','v1'),
('bb0e8400-e29b-41d4-a716-446655440017','550e8400-e29b-41d4-a716-446655440017',2023, 81,79,83,80,82,'{"rationale":"Rapid growth warrants monitoring; strong mission alignment"}','v1'),
('bb0e8400-e29b-41d4-a716-446655440018','550e8400-e29b-41d4-a716-446655440018',2023, 73,71,70,72,74,'{"rationale":"Compensation non-disclosure; program ratio strong for bilingual clinic"}','v1'),
('bb0e8400-e29b-41d4-a716-446655440019','550e8400-e29b-41d4-a716-446655440019',2023, 38,22,45,40,35,'{"rationale":"Severe financial distress; expenses exceed revenue; status inactive"}','v1'),
('bb0e8400-e29b-41d4-a716-446655440020','550e8400-e29b-41d4-a716-446655440020',2023, 83,82,85,84,81,'{"rationale":"Disaster surge year 2023; strong reserves; responsive governance"}','v1')
ON CONFLICT DO NOTHING;


-- ---------------------------------------------------------------------------
-- SCRAPE RUNS (4)
-- ---------------------------------------------------------------------------

INSERT INTO scrape_runs (
  id, source, spider_name, started_at, completed_at, status,
  records_found, records_new, records_updated, records_failed,
  metadata
) VALUES

('cc0e8400-e29b-41d4-a716-446655440001',
 'us_propublica', 'propublica_nonprofit_spider',
 '2024-02-01 02:00:00+00', '2024-02-01 05:42:17+00', 'completed',
 48312, 1204, 6881, 23,
 '{"pages_crawled": 4832, "avg_delay_ms": 2100, "robots_respected": true, "content_hash_hits": 39204}'),

('cc0e8400-e29b-41d4-a716-446655440002',
 'uk_charity_commission', 'charity_commission_spider',
 '2024-02-02 01:00:00+00', '2024-02-02 04:18:44+00', 'completed',
 169234, 812, 4103, 41,
 '{"pages_crawled": 16924, "avg_delay_ms": 2050, "robots_respected": true, "content_hash_hits": 164278}'),

('cc0e8400-e29b-41d4-a716-446655440003',
 'au_acnc', 'acnc_spider',
 '2024-02-03 03:00:00+00', '2024-02-03 04:55:09+00', 'completed',
 60218, 340, 2109, 18,
 '{"pages_crawled": 6022, "avg_delay_ms": 2200, "robots_respected": true, "content_hash_hits": 57751}'),

('cc0e8400-e29b-41d4-a716-446655440004',
 'in_ngo_darpan', 'ngo_darpan_spider',
 '2024-02-04 06:00:00+00', '2024-02-04 09:31:52+00', 'completed',
 148902, 2841, 9302, 187,
 '{"pages_crawled": 14891, "avg_delay_ms": 2300, "robots_respected": true, "content_hash_hits": 136573, "language_detected": "hi,en"}')

ON CONFLICT DO NOTHING;
