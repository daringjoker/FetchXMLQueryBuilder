import { create } from 'xmlbuilder2';
import { XMLBuilder } from 'xmlbuilder2/lib/interfaces';

type AliasObject = { [key: string]: string };

interface SelectRule {
  name: string;
  alias?: string;
}

interface JoinRule {
  name: string;
  alias?: string;
  from: string;
  to: string;
  columns: SelectRule[] | string;
  'link-type': string;
}

type JoinedTableRule = JoinRule & InternalRepresentation;

interface FilterRule {
  filterType: 'condition';
  attribute: string;
  value?: string | number | string[] | number[];
  operator: string;
}

interface FilterGroup {
  filterType: 'filterGroup';
  type: string;
  content: (FilterRule | FilterGroup)[];
}

interface OrderRule {
  attribute: string;
  descending?: boolean;
}

interface InternalRepresentation {
  name: string;
  entityName?: string;
  alias?: string;
  columns: SelectRule[] | string;
  joinRules: (JoinedTableRule | JoinRule)[];
  filterRules: (FilterRule | FilterGroup)[];
  orderRules: OrderRule[];
}

/**
 * Builds a fetchXML query string progressively.
 */
export class FetchXML {
  protected internals: InternalRepresentation = {
    name: '',
    columns: [],
    joinRules: [],
    filterRules: [],
    orderRules: []
  };

  private xml = create().ele('fetch', { version: '1.0' });

  /**
   * sets name of the table against which the query is to be executed
   *
   * @param tableEntity  can be a simple string or a object in for { alias : tableName}
   * used to describe both alias and name of the table against which the query is to be executed
   *
   * @example  q.table("userRecords") // sets table name to 'userRecords'
   *  q.table({ur:"userRecords"}) //sets table name to 'userRecords' and alias to 'ur'
   *
   */

  table(tableEntity: string | { [key: string]: string }) {
    if (typeof tableEntity === 'string') {
      this.internals.name = tableEntity;

      return this;
    }

    const [tableName] = Object.keys(tableEntity);
    const entityName = tableEntity[tableName];
    this.internals.name = tableName;
    this.internals.entityName = entityName;

    return this;
  }

  /**
   *  sets the fields to be fetched from the selected table
   * @param columnNames can be any number of strings or aliasObjects used to set the fields which should be present in the fetched data
   *
   * @example  q.select("first_name","user_email") //selects the fields 'first_name' and 'user_email'
   *           q.select({name:"first_name",email:"user_email"}) // selects field first_name and aliases it as name and 'user_email' as email
   *           q.select("*") // select all columns from the selected table
   *           q.select() // same as q.select('*')
   *           q.select({alias1:name1},{alias2:name2}) // there can be multiple alias Objects if names colide name defined last will be used.
   */
  select(...columnNames: (string | AliasObject)[]) {
    if (!columnNames.length || (columnNames.length === 1 && columnNames[0] === '*')) {
      this.internals.columns = '*';
      return this;
    }

    const columnList: SelectRule[] = [];
    columnNames.forEach((row) => {
      if (typeof row !== 'string') {
        Object.keys(row).forEach((colName) => {
          columnList.push({ alias: colName, name: row[colName] });
        });
      } else {
        columnList.push({ name: row });
      }
    });

    this.internals.columns = [
      ...(typeof this.internals.columns === 'string' ? [] : this.internals.columns),
      ...columnList
    ];

    return this;
  }

  /**
   * set the alias name for the table being selected
   * @param alias alias name for the table being selected
   */
  as(alias: string) {
    this.internals.alias = alias;

    return this;
  }

  orderBy(attribute: string) {
    this.internals.orderRules.push({ attribute });

    return this;
  }

  orderByDesc(attribute: string) {
    this.internals.orderRules.push({ attribute, descending: true });

    return this;
  }

  private joinEntity(
    joinObj: string | ((param: FetchXML) => void) | AliasObject,
    from: string,
    to: string,
    joinType: string
  ) {
    if (typeof joinObj === 'string') {
      this.internals.joinRules.push({
        name: joinObj,
        from,
        to,
        columns: '*',
        'link-type': joinType
      });
    } else if (typeof joinObj === 'function') {
      const q = new FetchXML();
      joinObj(q);
      this.internals.joinRules.push({ ...q.internals, from, to, 'link-type': joinType });
    } else {
      const [alias] = Object.keys(joinObj);
      this.internals.joinRules.push({
        name: joinObj[alias],
        alias,
        from,
        to,
        columns: '*',
        'link-type': joinType
      });
    }
  }

  outerJoin(joinObj: string | ((param: FetchXML) => void) | AliasObject, from: string, to: string) {
    this.joinEntity(joinObj, from, to, 'outer');

    return this;
  }

  innerJoin(joinObj: string | ((param: FetchXML) => void) | AliasObject, from: string, to: string) {
    this.joinEntity(joinObj, from, to, 'inner');

    return this;
  }

  join(joinObj: string | ((param: FetchXML) => void) | AliasObject, from: string, to: string) {
    this.joinEntity(joinObj, from, to, 'inner');

    return this;
  }

  where(attribute: string, value: string | number) {
    this.internals.filterRules.push({ filterType: 'condition', operator: 'eq', value, attribute });

    return this;
  }

  whereIn(attribute: string, value: string[] | number[]) {
    this.internals.filterRules.push({ filterType: 'condition', operator: 'in', value, attribute });

    return this;
  }

  whereNull(attribute: string) {
    this.internals.filterRules.push({ filterType: 'condition', operator: 'null', attribute });

    return this;
  }

  whereNotNull(attribute: string) {
    this.internals.filterRules.push({ filterType: 'condition', operator: 'not-null', attribute });

    return this;
  }

  whereLike(attribute: string, value: string) {
    this.internals.filterRules.push({
      filterType: 'condition',
      operator: 'like',
      attribute,
      value
    });

    return this;
  }

  whereNotLike(attribute: string, value: string) {
    this.internals.filterRules.push({
      filterType: 'condition',
      operator: 'not-like',
      attribute,
      value
    });

    return this;
  }

  whereNot(attribute: string, value: string | number) {
    this.internals.filterRules.push({
      filterType: 'condition',
      operator: 'ne',
      attribute,
      value
    });

    return this;
  }

  whereLessThan(attribute: string, value: string) {
    this.internals.filterRules.push({
      filterType: 'condition',
      operator: 'lt',
      attribute,
      value
    });

    return this;
  }

  whereOrGroup(orGroupQuery: (query: FetchXML) => void) {
    const q = new FetchXML();
    orGroupQuery(q);
    this.internals.filterRules.push({
      filterType: 'filterGroup',
      type: 'or',
      content: q.internals.filterRules
    });
    return this;
  }

  whereAndGroup(orGroupQuery: (query: FetchXML) => void) {
    const q = new FetchXML();
    orGroupQuery(q);
    this.internals.filterRules.push({
      filterType: 'filterGroup',
      type: 'and',
      content: q.internals.filterRules
    });
    return this;
  }

  private static prepareEntity(entity: XMLBuilder, obj: InternalRepresentation) {
    if (typeof obj.columns === 'string' && obj.columns === '*') {
      entity.ele('all-attributes');
    } else if (Array.isArray(obj.columns)) {
      obj.columns.forEach((col: SelectRule) => {
        entity.ele('attribute', col);
      });
    }
    obj?.joinRules?.forEach((rule: JoinRule) => {
      const linkEntity = entity.ele('link-entity', {
        name: rule.name,
        alias: rule.alias,
        to: rule.to,
        from: rule.from,
        'link-type': rule['link-type']
      });
      FetchXML.prepareEntity(linkEntity, rule as unknown as InternalRepresentation);
    });
    if (obj?.filterRules?.length) {
      const filterEntity = entity.ele('filter');
      this.resolveFilters(filterEntity, obj.filterRules);
    }
  }

  private static resolveFilters(entity: XMLBuilder, filters: (FilterRule | FilterGroup)[]) {
    filters.forEach((filter) => {
      if (filter.filterType === 'condition')
        switch (filter.operator) {
          case 'in':
            const whereInentity = entity.ele('condition', {
              attribute: filter.attribute,
              operator: filter.operator
            });

            if (Array.isArray(filter?.value)) {
              filter.value?.forEach((value) => whereInentity.ele('value', { value }));
            }
            break;
          default:
            entity.ele('condition', {
              attribute: filter.attribute,
              operator: filter.operator,
              value: filter.value
            });
        }
      else if (filter.filterType === 'filterGroup') {
        const filterGroup = entity.ele('filter', { type: filter.type });
        FetchXML.resolveFilters(filterGroup, filter.content);
      }
    });
  }

  private prepareXml() {
    const entity = this.xml.ele('entity', { name: this.internals.name });
    FetchXML.prepareEntity(entity, this.internals);
    this?.internals?.orderRules?.forEach((rule) => entity.ele('order', rule));
  }

  then(resolve: (Value: string | PromiseLike<string>) => void) {
    this.prepareXml();
    return resolve(this.xml.toString({ prettyPrint: true }).replace(/<\?xml.*?>/, ''));
  }
}
