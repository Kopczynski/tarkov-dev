import { Link } from 'react-router-dom';

import ContainedItemsList from '../contained-items-list/index.js';

import './index.css';

function ItemNameCell(props) {
    let {item, showContainedItems, showRestrictedType} = props;
    if (!item) {
        item = props.row.original;
    }
    let firImage = '';
    if (item.foundInRaid) {
        firImage = <img 
            alt="" 
            className="item-fir" 
            loading="lazy" 
            src={`${process.env.PUBLIC_URL}/images/icon-fir.png`}
        />
    }
    return (
        <div className="small-item-table-description-wrapper">
            <div className="small-item-table-image-wrapper">
                <Link
                    to={item.itemLink}
                >
                    <span style={{position: 'relative'}}>
                        <img
                            alt={item.name}
                            className="table-image"
                            loading="lazy"
                            src={item.iconLink}
                        />
                        {firImage}
                    </span>
                </Link>
            </div>
            <div className="small-item-table-name-wrapper">
                <Link
                    to={item.itemLink}
                >
                    {item.name}{item.count > 1 ? ` x ${item.count}` : ''}
                </Link>
                {showRestrictedType && (
                    <cite>
                        <ContainedItemsList item={item} showRestrictedType={showRestrictedType} />
                    </cite>
                )}
                {showContainedItems && (item.properties?.grids || item.properties?.slots) && (
                    <cite>
                        <ContainedItemsList item={item} />
                    </cite>
                )}
            </div>
        </div>
    );
}

export default ItemNameCell;
