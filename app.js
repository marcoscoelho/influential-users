// helper functions

function percentage (total, value, sign) {
  sign = (typeof sign == 'boolean') ? sign : true;
  result = (total != 0 ? ((value/total)*100) : 0);
  return _.round(result, 2)+(sign ? '%' : '');
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

function exportAs(mimetype, filename, data) {
  var uri, link;
  uri = 'data:'+mimetype+';charset=utf-8,' + escape(data);
  link = document.createElement('a');
  link.href = uri;
  link.style = 'visibility:hidden';
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

var API_ENDPOINT = 'https://raw.githubusercontent.com/alexandre-gauge/frontend_data/master{/resource}';
var influence = new Vue({
  el: '#influential-rank',
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
        this.$nextTick(function () {
          this.drawCharts();
        });
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
    drawCharts: function () {
      var self = this;
      this.typesOfInteraction.forEach(function (type, index) {
        var wrap = document.getElementById('chart-'+self.lowercase(type.id)),
            element = wrap.getElementsByClassName('chart')[0],
            color;
        switch (type.id) {
          case 'FAVORITE':
            color = '#E43D1D';
            break;
          case 'SHARE':
            color = '#217FBE';
            break;
          case 'COMMENT':
            color = '#FF9500';
            break;
        }
        type.chart = new EasyPieChart(element, {
          easing: 'easeOutElastic',
          delay: 3000,
          barColor: color,
          trackColor: '#ccc',
          scaleColor: false,
          size: 70,
          lineWidth: 5,
          trackWidth: 1,
          lineCap: 'round',
          onStep: function(from, to, percent) {
            this.el.children[0].innerHTML = _.round(percent, 2);
          }
        });
        self.$watch(
          function () {
            return self.percentageOfInteraction(type, null, false);
          },
          function (newVal, oldVal) {
            type.chart.update(newVal);
          }
        );
      });
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
    percentageOfInteraction: function (type, user, sign) {
      var total, value;
      if (user) {
        total = this.numberOfInteractions({ user: user.id });
        value = this.numberOfInteractions({ type: type.id, user: user.id });
      } else {
        total = this.totalInteractions
        value = this.numberOfInteractions({ type: type.id });
      }
      return percentage(total, value, sign);
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
    exportsAsJSON: function () {
      var dataJSON = JSON.stringify(this.influentialUsers, null, 2);
      exportAs('application/json', 'influential-users.json', dataJSON);
    },
    exportsAsCSV: function () {
      var dataCSV = json2csv({
        data: this.influentialUsers,
        fields: [
          'id', 'gender', 'name.title', 'name.first', 'name.last', 'email',
          'age', 'phone', 'cell', 'nat', 'location.state', 'location.city',
          'location.street', 'location.postcode', 'totalInteractions'
        ],
        fieldNames: [
          '#ID', 'Gender', 'Title', 'First Name', 'Last Name', 'Email', 'Age',
          'Phone Number', 'Cell Number', 'Nat', 'State', 'City', 'Street',
          'Postcode', 'Interactions'
        ],
        del: ';'
      });
      exportAs('text/csv', 'influential-users.csv', dataCSV);
    }
  }
});
