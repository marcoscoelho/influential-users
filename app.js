// helper functions

function percentage (total, value) {
  result = (total != 0 ? ((value/total)*100) : 0);
  return _.round(result, 2)+'%';
}

function age(dob) {
    var today = new Date();
    var birthDate = new Date(dob*1000);
    var age = today.getFullYear() - birthDate.getFullYear();
    var m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}

var API_ENDPOINT = 'https://raw.githubusercontent.com/alexandre-gauge/frontend_data/master{/resource}';
var influence = new Vue({
  el: '#influence',
  data: {
    userOrder: {
      orderBy: 'totalInteractions',
      order: 'desc'
    },
    userFilters: {
      gender: {
        male : true,
        female : true
      },
      ageGroup: {
        tens : true,
        adults : true
      }
    },
    brands: [],
    interactions: [],
    users: [],
    typesOfInteraction: []
  },
  computed: {
    activeTypes: function () {
      return this.typesOfInteraction.filter(function (type) {
        return type.active;
      });
    },
    activeBrands: function () {
      return this.brands.filter(function (brand) {
        return brand.active;
      });
    },
    filteredInteractions: function () {
      var self = this;
      return this.interactions.filter(function (interaction) {
        return (_.findIndex(self.filteredUsers, ['id', interaction.user]) > -1) &&
               (_.findIndex(self.activeBrands, ['id', interaction.brand]) > -1) &&
               (_.findIndex(self.activeTypes, ['id', interaction.type]) > -1);
      });
    },
    filteredUsers: function () {
      var self = this;
      return this.users.filter(function (user) {
        return self.checkFilter('gender', user.gender) &&
               self.checkFilter('ageGroup', user.ageGroup);
      });
    },
    influentialUsers: function () {
      var self = this;
      return _.orderBy(
        this.users.reduce(function (users, user) {
          user.totalInteractions = self.numberOfInteractions({ user: user.id });
          if (user.totalInteractions > 0) users.push(user);
          return users;
        }, []),
        [this.userOrder.orderBy, 'name.first'],
        [this.userOrder.order, 'asc']
      );
    },
    totalInteractions: function() {
      return this.filteredInteractions.length;
    },
    totalUsers: function() {
      return this.influentialUsers.length;
    }
  },
  created: function () {
    var self = this;
    this.fetchData('brands');
    this.fetchData('interactions');
    this.fetchData('users');
  },
  methods: {
    fetchData: function (resource) {
      this.$resource(API_ENDPOINT)
        .get({ resource: resource + '.json' })
        .then(function (response) {
          var data = JSON.parse(response.body);
          data = this.parseData(resource, data);
          data = this.sortData(resource, data);
          data = this.transformData(resource, data);
          this[resource] = data;
        }).bind(this);
    },
    parseData: function (resource, data) {
      if (resource != 'interactions') {
        // fix wrong duplications
        data = _.uniqBy(data, 'id');
      } else {
        this.typesOfInteraction = this.extractTypes(data);
      }
      return data;
    },
    sortData: function (resource, data) {
      if (resource == 'brands') {
        data = _.sortBy(data, 'name');
      }
      return data;
    },
    transformData: function (resource, data) {
      _.map(data, function(item){
        if (resource == 'users'){
          item.age = age(item.dob);
          item.ageGroup = (item.age > 18 ? 'adults' : 'tens');
          item.fullName = [
            _.upperFirst(item.name.title),
            _.upperFirst(item.name.first),
            _.upperFirst(item.name.last)
          ].join(' ');
        } else {
          item.active = true;
        }
      });
      return data;
    },
    extractTypes: function (interactions) {
      var interactions = _.uniqBy(interactions, 'type');
      return _.sortBy(interactions.reduce(function (result, interaction) {
        result.push({
          id: _.toUpper(interaction.type),
          name: _.upperFirst(_.toLower(interaction.type)),
          active: true
        });
        return result;
      }, []), 'name');
    },
    checkFilter: function (name, filter) {
      return this.userFilters[name][filter];
    },
    toggleFilter: function (name, filter) {
      this.userFilters[name][filter] = !this.checkFilter(name, filter);
    },
    toggleActive: function (item) {
      item.active = !item.active;
    },
    sortUsersBy: function (orderBy, order) {
      this.userOrder.orderBy = orderBy;
      this.userOrder.order = order;
    },
    numberOfInteractions: function (matches) {
      return _.filter(this.filteredInteractions, matches).length;
    },
    percentageOfInteraction: function (user, type) {
      return percentage(
        this.numberOfInteractions({ user: user.id }),
        this.numberOfInteractions({ user: user.id, type: type.id })
      );
    },
    percentageOfInfluence: function (user) {
      return percentage(
        this.totalInteractions,
        this.numberOfInteractions({ user: user.id })
      );
    },
    lowercase: function (value) {
      if (!value) return;
      return _.toLower(value)
    },
    exportsAsCSV: function () {
      var CSV, uri, link;
      CSV = json2csv({
        data: this.influentialUsers,
        fields: [
          'id', 'gender', 'name.title', 'name.first', 'name.last', 'email',
          'age', 'phone', 'cell', 'nat', 'location.state', 'location.city',
          'location.street', 'location.postcode', 'totalInteractions'
        ],
        fieldNames: [
          '#', 'Gender', 'Title', 'First Name', 'Last Name', 'Email', 'Age',
          'Phone Number', 'Cell Number', 'Nat', 'State', 'City', 'Street',
          'Postcode', 'Interactions'
        ],
        del: ';'
      });
      uri = 'data:text/csv;charset=utf-8,' + escape(CSV);
      link = document.createElement('a');
      link.href = uri;
      link.style = 'visibility:hidden';
      link.download = 'influential-users.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }
});
