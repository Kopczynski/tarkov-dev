import fs from 'fs';

import doFetchItems from '../src/features/items/do-fetch-items.mjs';
import doFetchBarters from '../src/features/barters/do-fetch-barters.mjs';
import doFetchCrafts from '../src/features/crafts/do-fetch-crafts.mjs';
import doFetchTraders from '../src/features/traders/do-fetch-traders.mjs';
import doFetchMaps from '../src/features/maps/do-fetch-maps.mjs';
import doFetchMeta from '../src/features/meta/do-fetch-meta.mjs';
import doFetchHideout from '../src/features/hideout/do-fetch-hideout.mjs';
import doFetchQuests from '../src/features/quests/do-fetch-quests.mjs';
import doFetchBosses from '../src/features/bosses/do-fetch-bosses.mjs';
import graphqlRequest from '../src/modules/graphql-request.mjs';

async function getLanguageCodes() {
    const query = `{
        __type(name: "LanguageCode") {
            enumValues {
                name
            }
        }
    }`;
    return graphqlRequest(query).then(response => response.data.__type.enumValues.map(lang => {
        return lang.name;
    }));
}

const getItemNames = async (langs) => {
    const queries = langs.map(language => {
        return `${language}: items(lang: ${language}) {
            id
            name
            shortName
        }`;
    });
    const query = `{
        ${queries.join('\n')}
    }`;
    const response = await graphqlRequest(query);
    return response.data;
};

const getTaskNames = async (langs) => {
    const queries = langs.map(language => {
        return `${language}: tasks(lang: ${language}) {
            id
            name
            objectives {
                id
                description
            }
        }`;
    });

    const query = `{
        ${queries.join('\n')}
    }`;
    return graphqlRequest(query).then(response => response.data);
};

const getTraderNames = async (langs) => {
    const queries = langs.map(language => {
        return `${language}: traders(lang: ${language}) {
            id
            name
        }`;
    });
    const query = `{
        ${queries.join('\n')}
    }`;
    return graphqlRequest(query).then(response => response.data);
};

const getMapNames = async (langs) => {
    const queries = langs.map(language => {
        return `${language}: maps(lang: ${language}) {
            id
            name
            description
        }`;
    });
    const query = `{
        ${queries.join('\n')}
    }`;
    return graphqlRequest(query).then(response => response.data);
};

const getBossNames = async (langs) => {
    const queries = langs.map(language => {
        return `${language}: bosses(lang: ${language}) {
            name
            normalizedName
        }`;
    });
    const query = `{
        ${queries.join('\n')}
    }`;
    return graphqlRequest(query).then(response => response.data);
};

console.time('Caching API data');
try {
    const allLangs = await getLanguageCodes();
    fs.writeFileSync('./src/data/supported-languages.json', JSON.stringify(allLangs, null, 4));
    const langs = allLangs.filter(lang => lang !== 'en');
    const apiPromises = [];

    apiPromises.push(Promise.all([
        doFetchBarters({prebuild: true}).then(barters => {
            for (const barter of barters) {
                barter.cached = true;
            }
            const bartersCnt2 = barters.length / 2;
            while( barters.length > bartersCnt2 ) {
                var index = Math.floor( Math.random() * barters.length );
                barters.splice( index, 1 );     // Remove the item from the array
            }

            fs.writeFileSync('./src/data/barters_cached.json', JSON.stringify(barters));
            return barters;
        }),
        doFetchCrafts({prebuild: true}).then(crafts => {
            for (const craft of crafts) {
                craft.cached = true;
            }
            const craftsCnt2 = crafts.length / 2;
            while( crafts.length > craftsCnt2 ) {
                var index = Math.floor( Math.random() * crafts.length );
                crafts.splice( index, 1 );     // Remove the item from the array
            }

            fs.writeFileSync('./src/data/crafts_cached.json', JSON.stringify(crafts));
            return crafts;
        })
    ]).then((bartersAndCrafts) => {
        return doFetchItems({prebuild: true}).then(items => {
            const filteredItems = [];
            for (const bartersCrafts of bartersAndCrafts) {
                bartersCrafts.forEach(bc => {
                    for (const cItem of bc.rewardItems) {
                        if (!filteredItems.some(i => i.id === cItem.item.id)) {
                            filteredItems.push(items.find(i => i.id === cItem.item.id));
                        }
                    }
                    for (const cItem of bc.requiredItems) {
                        if (!filteredItems.some(i => i.id === cItem.item.id)) {
                            filteredItems.push(items.find(i => i.id === cItem.item.id));
                        }
                    }
                });
            }
            for (const item of filteredItems) {
                if (!item.types.includes('preset')) {
                    continue;
                }
                const baseItem = items.find(i => i.id === item.properties.baseItem.id);
                if (!filteredItems.some(i => i.id === baseItem.id)) {
                    filteredItems.push(baseItem);
                }
            }
            for (const item of filteredItems) {
                if (!item.types.includes('gun')) {
                    continue;
                }
                const defaultPreset = items.find(i => i.id === item.properties?.defaultPreset?.id);
                if (defaultPreset && !filteredItems.some(i => i.id === defaultPreset.id)) {
                    filteredItems.push(defaultPreset);
                }
            }

            const groupedAmmoDic = items.reduce((acc, item) => {
                if (!item.categories.some(cat => cat.id === '5485a8684bdc2da71d8b4567'))
                    return acc;

                if (filteredItems.some(i => i.id === item.id))
                    return acc;

                const caliberType = item.properties.caliber + item.properties.ammoType;
                if (!acc[caliberType]) {
                    acc[caliberType] = [];
                }
                acc[caliberType].push(item);
                return acc;
            }, {});
            const filteredAmmoDic = Object.values(groupedAmmoDic).map(group => group.sort((a, b) => b.properties.damage - a.properties.damage).slice(0, 2));
            const filteredAmmo = [].concat(...filteredAmmoDic);
            filteredItems.push(...filteredAmmo);

            for (const item of filteredItems) {
                item.lastLowPrice = 0;
                item.avg24hPrice = 0;
                item.buyFor = []; //item.buyFor.filter(buyFor => buyFor.vendor.normalizedName !== 'flea-market');
                item.sellFor = []; //item.sellFor.filter(sellFor => sellFor.vendor.normalizedName !== 'flea-market');
                item.updated = '';
                item.cached = true;
            }
            fs.writeFileSync('./src/data/items_cached.json', JSON.stringify(filteredItems));
            return new Promise(async (resolve) => {
                const itemLangs = {};
                await getItemNames(langs).then(itemResults => {
                    for (const lang in itemResults) {
                        const localization = {};
                        itemResults[lang].forEach(item => {
                            if (filteredItems.find(filteredItem => filteredItem.id == item.id)) {
                                localization[item.id] = {
                                    name: item.name,
                                    shortName: item.shortName
                                };
                            }
                        });
                        itemLangs[lang] = localization;
                    }
                });
                fs.writeFileSync(`./src/data/items_locale.json`, JSON.stringify(itemLangs));
                resolve();
            });
        });
    }));

    apiPromises.push(doFetchHideout({prebuild: true}).then(hideout => {
        fs.writeFileSync('./src/data/hideout_cached.json', JSON.stringify(hideout));
    }));

    apiPromises.push(doFetchTraders({prebuild: true}).then(traders => {
        for (const trader of traders) {
            delete trader.resetTime;
        }
        fs.writeFileSync('./src/data/traders_cached.json', JSON.stringify(traders));

        return new Promise(async (resolve) => {
            const traderLangs = {};
            await getTraderNames(langs).then(traderResults => {
                for (const lang in traderResults) {
                    const localization = {};
                    traderResults[lang].forEach(trader => {
                        localization[trader.id] = {
                            name: trader.name
                        };
                    });
                    traderLangs[lang] = localization;
                }
            });
            fs.writeFileSync(`./src/data/traders_locale.json`, JSON.stringify(traderLangs));
            resolve();
        });
    }));

    apiPromises.push(doFetchMaps({prebuild: true}).then(maps => {
        maps = maps.map(map => {
            return {
                ...map,
                extracts: [],
                hazards: [],
                locks: [],
                lootContainers: [],
                lootLoose: [],
                spawns: [],
                switches: [],
                transits: [],
            };
        });
        fs.writeFileSync('./src/data/maps_cached.json', JSON.stringify(maps));

        return getMapNames(langs).then(mapResults => {
            const mapLangs = {};
            for (const lang in mapResults) {
                const localization = {};
                mapResults[lang].forEach(map => {
                    localization[map.id] = {
                        name: map.name,
                        description: map.description,
                    };
                });
                mapLangs[lang] = localization;
            }
            fs.writeFileSync(`./src/data/maps_locale.json`, JSON.stringify(mapLangs));
        });
    }));

    apiPromises.push(doFetchBosses({prebuild: true}).then(bosses => {
        for (const boss of bosses) {
            boss.items = [];
            boss.equipment = [];
        }
        fs.writeFileSync('./src/data/bosses_cached.json', JSON.stringify(bosses));

        return getBossNames(langs).then(bossResults => {
            const bossLangs = {};
            for (const lang in bossResults) {
                const localization = {};
                bossResults[lang].forEach(boss => {
                    localization[boss.normalizedName] = {
                        name: boss.name,
                    };
                });
                bossLangs[lang] = localization;
            }
            fs.writeFileSync(`./src/data/bosses_locale.json`, JSON.stringify(bossLangs));
        });
    }));

    apiPromises.push(doFetchMeta({prebuild: true}).then(meta => {
        fs.writeFileSync('./src/data/meta_cached.json', JSON.stringify(meta));
    }));

    apiPromises.push(doFetchQuests({prebuild: true}).then(quests => {
        const groupedQuestsDic = quests.reduce((acc, item) => {
            if (!acc[item.trader.normalizedName]) {
                acc[item.trader.normalizedName] = [];
            }
            if (item.minPlayerLevel < 20)
                acc[item.trader.normalizedName].push(item);
            return acc;
        }, {});
        const filteredQuestsDic = Object.values(groupedQuestsDic).map(group => group.slice(0, 20));
        const filteredQuests = [].concat(...filteredQuestsDic);
        // const filteredQuests = [].concat(...groupedQuestsDic);

        fs.writeFileSync('./src/data/quests_cached.json', JSON.stringify(filteredQuests));

        return new Promise(async (resolve) => {
            const taskLangs = {};
            await getTaskNames(langs).then(taskResults => {
                for (const lang in taskResults) {
                    const localization = {};
                    taskResults[lang].forEach(task => {
                        if (filteredQuests.find(filteredQuest => filteredQuest.id === task.id)) {
                            localization[task.id] = {
                                name: task.name,
                                objectives: {}
                            };
                            task.objectives.forEach(objective => {
                                localization[task.id].objectives[objective.id] = objective.description;
                            });
                        }
                    });
                    taskLangs[lang] = localization;
                }
            });
            fs.writeFileSync(`./src/data/quests_locale.json`, JSON.stringify(taskLangs));
            resolve();
        });
    }));

    await Promise.all(apiPromises);
}
catch (error) {
    if (process.env.CI) {
        throw error;
    }
    else {
        console.log(error);
        console.log("attempting to use pre-cached values (offline mode?)");
    }
}
console.timeEnd('Caching API data');
